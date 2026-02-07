"""
Pipecat voice agent for Elevate Edge HVAC intake calls.

Pipeline: Deepgram STT → OpenAI GPT-4o → Murf TTS (en-US-natalie)
Transport: Twilio WebSocket Media Streams
"""

import json
import os
import sys
from typing import Optional

import aiohttp
from dotenv import load_dotenv
from loguru import logger

from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.audio.vad.vad_analyzer import VADParams
from pipecat.frames.frames import LLMRunFrame, EndFrame
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineParams, PipelineTask
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import (
    LLMContextAggregatorPair,
    LLMUserAggregatorParams,
)
from pipecat.runner.types import RunnerArguments
from pipecat.runner.utils import parse_telephony_websocket
from pipecat.serializers.twilio import TwilioFrameSerializer
from pipecat.services.deepgram.stt import DeepgramSTTService
from pipecat.services.openai.llm import OpenAILLMService
from pipecat.transports.base_transport import BaseTransport
from pipecat.transports.websocket.fastapi import (
    FastAPIWebsocketParams,
    FastAPIWebsocketTransport,
)

from pipecat.adapters.schemas.function_schema import FunctionSchema
from pipecat.adapters.schemas.tools_schema import ToolsSchema
from pipecat.services.llm_service import FunctionCallParams
from pipecat_murf_tts import MurfTTSService

load_dotenv(override=True)

logger.remove(0)
logger.add(sys.stderr, level="DEBUG")


# ── HVAC Intake Field Definitions ──────────────────────────────────────────────

DESIGN_FIELDS = [
    {"key": "buildingType", "label": "Building Type", "required": True},
    {"key": "buildingSize", "label": "Building Size (sq ft)", "required": True},
    {"key": "location", "label": "Location", "required": True},
    {"key": "projectGoals", "label": "Project Goals", "required": True},
    {"key": "timeline", "label": "Timeline", "required": True},
    {"key": "budget", "label": "Budget Range", "required": False},
    {"key": "existingSystem", "label": "Existing System", "required": False},
    {"key": "specialRequirements", "label": "Special Requirements", "required": False},
]

SERVICE_FIELDS = [
    {"key": "systemType", "label": "System Type", "required": True},
    {"key": "systemAge", "label": "System Age", "required": True},
    {"key": "symptoms", "label": "Symptoms/Issue", "required": True},
    {"key": "urgency", "label": "Urgency Level", "required": True},
    {"key": "location", "label": "Location", "required": True},
    {"key": "siteConstraints", "label": "Site Constraints", "required": False},
    {"key": "makeModel", "label": "Make and Model", "required": False},
]

QUOTE_FIELDS = [
    {"key": "projectScope", "label": "Project Scope", "required": True},
    {"key": "buildingType", "label": "Building Type", "required": True},
    {"key": "buildingSize", "label": "Building Size (sq ft)", "required": True},
    {"key": "location", "label": "Location", "required": True},
    {"key": "existingSystem", "label": "Existing System", "required": False},
    {"key": "timeline", "label": "Timeline", "required": False},
    {"key": "budget", "label": "Budget Range", "required": False},
]

CALL_TYPE_FIELDS = {
    "design": DESIGN_FIELDS,
    "service": SERVICE_FIELDS,
    "quote": QUOTE_FIELDS,
}

CALL_TYPE_LABELS = {
    "design": "an HVAC design consultation",
    "service": "your HVAC service request",
    "quote": "your HVAC quote request",
    "general": "your HVAC inquiry",
}


def build_system_prompt(
    direction: str = "inbound",
    call_type: str | None = None,
    caller_name: str | None = None,
) -> str:
    """Build the comprehensive system prompt for the HVAC intake agent."""

    fields_section = ""
    if call_type and call_type in CALL_TYPE_FIELDS:
        fields = CALL_TYPE_FIELDS[call_type]
        required = [f for f in fields if f["required"]]
        optional = [f for f in fields if not f["required"]]
        fields_section = f"""
You are conducting a {call_type} intake call.

REQUIRED fields to collect (MUST get all of these):
{chr(10).join(f'- {f["key"]}: {f["label"]}' for f in required)}

OPTIONAL fields to ask about:
{chr(10).join(f'- {f["key"]}: {f["label"]}' for f in optional)}

When you believe ALL required fields have been collected, AND you have asked about optional fields:
1. Read back a brief summary of what was collected
2. Ask the caller to confirm everything is correct
3. Ask "Is there anything else I can help you with?"
4. Only after they confirm should you call the complete_intake function
"""
    else:
        fields_section = """
You have not yet determined the call type. Your first task is to find out what the caller needs.
Listen to what they say and classify their intent:
- "design" — New HVAC system design, heat pump installation, building retrofit, new construction HVAC
- "service" — Repair, maintenance, troubleshooting an existing HVAC system
- "quote" — Requesting a price estimate or quote
- "emergency" — Gas leak, carbon monoxide, no heat in freezing conditions, fire/smoke from equipment
- "general" — General questions

Once you identify the call type, call the classify_call function with the appropriate type.
If it's an emergency, immediately provide safety instructions, assure them a technician will call back within 15 minutes, and call complete_intake with emergency details.
"""

    greeting = ""
    if direction == "outbound":
        name_part = f", {caller_name}" if caller_name else ""
        if call_type and call_type != "unknown":
            label = CALL_TYPE_LABELS.get(call_type, "your HVAC inquiry")
            greeting = f'Start the conversation with: "Hi{name_part}, this is Elevate Edge calling about {label}. I\'m an AI assistant and I\'d like to collect some details to get you connected with the right specialist. Do you have a few minutes to go through some questions?"'
        else:
            greeting = f'Start the conversation with: "Hi{name_part}, this is Elevate Edge calling. I\'m an AI assistant. I\'d like to help you with your HVAC needs. Could you tell me what you\'re looking for — a design consultation, service, a quote, or something else?"'
    else:
        greeting = 'Start the conversation with: "Thank you for calling Elevate Edge. I\'m your AI assistant and I can help you with HVAC design consultations, service requests, quotes, and emergencies. How can I help you today?"'

    return f"""You are a friendly, professional AI phone agent for Elevate Edge, an HVAC consulting company.
Your responses will be read aloud over a phone call, so:
- Keep responses conversational, warm, and under 3 sentences
- Do NOT use special characters, markdown, bullet points, or formatting
- Spell out numbers and abbreviations naturally
- Sound natural and human-like

{greeting}

{fields_section}

IMPORTANT RULES:
- NEVER rush through the call. Take your time and be thorough.
- If the caller provides information for multiple fields at once, extract all of them.
- Always ask about optional fields too — they help serve the caller better.
- If the caller goes silent or seems confused, gently re-ask your last question.
- Always extract the caller's name, email, and address if mentioned at any point — call update_caller_info.
- Do NOT say goodbye or end the call until the intake is fully complete and confirmed.
- If the caller asks a question you can't answer, let them know a specialist will follow up.
"""


# ── OpenAI Function Definitions ────────────────────────────────────────────────

TOOL_SCHEMAS = ToolsSchema(
    standard_tools=[
        FunctionSchema(
            name="classify_call",
            description="Classify the type of call based on the caller's first response. Call this once you understand what the caller needs.",
            properties={
                "call_type": {
                    "type": "string",
                    "enum": ["design", "service", "quote", "emergency", "general"],
                    "description": "The classified call type",
                },
            },
            required=["call_type"],
        ),
        FunctionSchema(
            name="update_intake_fields",
            description="Update intake fields with information extracted from the caller's speech. Call this whenever the caller provides information that matches an intake field.",
            properties={
                "fields": {
                    "type": "object",
                    "description": "Key-value pairs of field names and their values extracted from the caller's speech",
                    "additionalProperties": {"type": "string"},
                },
            },
            required=["fields"],
        ),
        FunctionSchema(
            name="update_caller_info",
            description="Update caller contact information when mentioned during the conversation.",
            properties={
                "name": {"type": "string", "description": "Caller's name"},
                "email": {"type": "string", "description": "Caller's email address"},
                "address": {"type": "string", "description": "Caller's address"},
            },
            required=[],
        ),
        FunctionSchema(
            name="complete_intake",
            description="Mark the intake as complete. ONLY call this after: 1) All required fields are collected, 2) Optional fields have been asked about, 3) A summary has been read back and confirmed by the caller, 4) The caller confirms they have nothing else to add.",
            properties={
                "summary": {
                    "type": "string",
                    "description": "Brief summary of the entire call and collected information",
                },
            },
            required=["summary"],
        ),
    ]
)


# ── Call State ─────────────────────────────────────────────────────────────────

class CallState:
    """Tracks the state of a single call session."""

    def __init__(
        self,
        call_sid: str,
        caller_number: str,
        direction: str = "inbound",
        call_type: str | None = None,
        caller_name: str | None = None,
    ):
        self.call_sid = call_sid
        self.caller_number = caller_number
        self.direction = direction
        self.call_type = call_type
        self.caller_name = caller_name
        self.caller_email: str | None = None
        self.caller_address: str | None = None
        self.intake_data: dict[str, str] = {}
        self.summary: str | None = None
        self.turns: list[dict] = []
        self.is_complete = False
        self.turn_counter = 0
        self._saved = False  # guard against double-save

    def add_turn(self, role: str, content: str, extracted_data: dict | None = None):
        self.turn_counter += 1
        self.turns.append({
            "role": role,
            "content": content,
            "turnNumber": self.turn_counter,
            "extractedData": json.dumps(extracted_data) if extracted_data else None,
        })

    def to_payload(self) -> dict:
        return {
            "twilioCallSid": self.call_sid,
            "callerNumber": self.caller_number,
            "direction": self.direction,
            "callType": self.call_type or "unknown",
            "callerName": self.caller_name,
            "callerEmail": self.caller_email,
            "callerAddress": self.caller_address,
            "intakeData": json.dumps(self.intake_data) if self.intake_data else None,
            "summary": self.summary,
            "turns": self.turns,
        }


# ── Bot Pipeline ───────────────────────────────────────────────────────────────

async def run_bot(
    transport: BaseTransport,
    handle_sigint: bool,
    call_state: CallState,
):
    """Set up and run the Pipecat pipeline."""

    stt = DeepgramSTTService(
        api_key=os.getenv("DEEPGRAM_API_KEY"),
    )

    llm = OpenAILLMService(
        api_key=os.getenv("OPENAI_API_KEY"),
        model="gpt-4o",
    )

    tts = MurfTTSService(
        api_key=os.getenv("MURF_API_KEY"),
        params=MurfTTSService.InputParams(
            voice_id="en-US-natalie",
            style="Conversational",
            model="FALCON",
            sample_rate=8000,
            channel_type="MONO",
            format="PCM",
        ),
    )

    system_prompt = build_system_prompt(
        direction=call_state.direction,
        call_type=call_state.call_type,
        caller_name=call_state.caller_name,
    )

    messages = [{"role": "system", "content": system_prompt}]

    context = LLMContext(messages, tools=TOOL_SCHEMAS)
    user_aggregator, assistant_aggregator = LLMContextAggregatorPair(
        context,
        user_params=LLMUserAggregatorParams(
            vad_analyzer=SileroVADAnalyzer(params=VADParams(stop_secs=0.5)),
        ),
    )

    pipeline = Pipeline(
        [
            transport.input(),
            stt,
            user_aggregator,
            llm,
            tts,
            transport.output(),
            assistant_aggregator,
        ]
    )

    task = PipelineTask(
        pipeline,
        params=PipelineParams(
            audio_in_sample_rate=8000,
            audio_out_sample_rate=8000,
            enable_metrics=True,
            enable_usage_metrics=True,
        ),
    )

    # ── Function Call Handlers ──

    async def handle_classify_call(params: FunctionCallParams):
        args = params.arguments
        call_type = args.get("call_type", "general")
        call_state.call_type = call_type
        logger.info(f"Call classified as: {call_type}")

        if call_type == "emergency":
            await params.result_callback("Call classified as emergency. Provide immediate safety instructions and assure the caller a technician will call back within 15 minutes.")
            return

        # Initialize intake data for the call type
        fields = CALL_TYPE_FIELDS.get(call_type, [])
        for field in fields:
            if field["key"] not in call_state.intake_data:
                call_state.intake_data[field["key"]] = ""

        # Update system prompt with field-specific instructions
        new_prompt = build_system_prompt(
            direction=call_state.direction,
            call_type=call_type,
            caller_name=call_state.caller_name,
        )
        params.context.messages[0] = {"role": "system", "content": new_prompt}

        await params.result_callback(f"Call classified as {call_type}. Now begin collecting the intake information by asking about the first required field.")

    async def handle_update_intake(params: FunctionCallParams):
        args = params.arguments
        fields = args.get("fields", {})
        for key, value in fields.items():
            if value:
                call_state.intake_data[key] = value
                logger.info(f"Intake field updated: {key} = {value}")

        # Calculate progress
        all_fields = CALL_TYPE_FIELDS.get(call_state.call_type, [])
        required = [f for f in all_fields if f["required"]]
        collected_required = [f for f in required if call_state.intake_data.get(f["key"])]
        remaining = [f for f in all_fields if not call_state.intake_data.get(f["key"])]

        status = f"Updated {len(fields)} field(s). {len(collected_required)}/{len(required)} required fields collected."
        if remaining:
            remaining_labels = ", ".join(f["label"] for f in remaining)
            status += f" Still needed: {remaining_labels}."
        else:
            status += " All fields collected! Read back a summary and ask the caller to confirm."

        await params.result_callback(status)

    async def handle_update_caller(params: FunctionCallParams):
        args = params.arguments
        if args.get("name"):
            call_state.caller_name = args["name"]
        if args.get("email"):
            call_state.caller_email = args["email"]
        if args.get("address"):
            call_state.caller_address = args["address"]
        logger.info(f"Caller info updated: name={call_state.caller_name}, email={call_state.caller_email}")
        await params.result_callback("Caller information updated. Continue with the intake.")

    async def handle_complete_intake(params: FunctionCallParams):
        args = params.arguments
        call_state.summary = args.get("summary", "")
        call_state.is_complete = True
        logger.info(f"Intake complete! Summary: {call_state.summary}")
        await params.result_callback("Thank the caller warmly, let them know a specialist will follow up soon, and say goodbye.")

    llm.register_function("classify_call", handle_classify_call)
    llm.register_function("update_intake_fields", handle_update_intake)
    llm.register_function("update_caller_info", handle_update_caller)
    llm.register_function("complete_intake", handle_complete_intake)

    # ── Transport Event Handlers ──

    @transport.event_handler("on_client_connected")
    async def on_client_connected(transport, client):
        logger.info(f"Client connected for call {call_state.call_sid}")
        # Kick off the conversation — the LLM will speak the greeting
        messages.append({"role": "system", "content": "Please greet the caller now."})
        await task.queue_frames([LLMRunFrame()])

    @transport.event_handler("on_client_disconnected")
    async def on_client_disconnected(transport, client):
        logger.info(f"Client disconnected for call {call_state.call_sid}")
        # Extract turns and data from the LLM context before saving
        await extract_from_context(context, call_state)
        await save_call_data(call_state)
        await task.cancel()

    # ── Run ──

    runner = PipelineRunner(handle_sigint=handle_sigint, force_gc=True)
    await runner.run(task)

    # If we got here naturally (pipeline ended), also save
    if not call_state.is_complete:
        logger.info("Pipeline ended without completion, saving partial data")
    await extract_from_context(context, call_state)
    await save_call_data(call_state)


async def extract_from_context(context: LLMContext, call_state: CallState):
    """Extract conversation turns and intake data from the LLM context messages.

    This is called when the call ends to capture the full conversation transcript
    and, if the LLM didn't use function calling to extract fields, do a
    post-call extraction using OpenAI.
    """
    try:
        # 1) Build turns from context messages
        if not call_state.turns:
            turn_number = 0
            for msg in context.messages:
                role = msg.get("role", "")
                content = msg.get("content", "")
                if not content or role == "system":
                    continue
                if role == "user":
                    turn_number += 1
                    call_state.turns.append({
                        "role": "caller",
                        "content": content,
                        "turnNumber": turn_number,
                        "extractedData": None,
                    })
                elif role == "assistant":
                    turn_number += 1
                    call_state.turns.append({
                        "role": "agent",
                        "content": content,
                        "turnNumber": turn_number,
                        "extractedData": None,
                    })

            logger.info(f"Extracted {len(call_state.turns)} turns from context")

        # 2) If intake data was not captured via function calls, extract it now
        if not call_state.intake_data or all(v == "" for v in call_state.intake_data.values()):
            logger.info("Intake data empty, running post-call extraction...")

            # Build conversation transcript
            transcript = "\n".join(
                f"{'Agent' if t['role'] == 'agent' else 'Caller'}: {t['content']}"
                for t in call_state.turns
            )

            if transcript.strip():
                extracted = await post_call_extraction(
                    transcript,
                    call_state.call_type or "unknown",
                )
                if extracted:
                    call_state.intake_data = extracted.get("fields", {})
                    call_state.summary = extracted.get("summary", call_state.summary)
                    if extracted.get("callerName"):
                        call_state.caller_name = extracted["callerName"]
                    if extracted.get("callerEmail"):
                        call_state.caller_email = extracted["callerEmail"]
                    if extracted.get("callerAddress"):
                        call_state.caller_address = extracted["callerAddress"]
                    if not call_state.call_type or call_state.call_type == "unknown":
                        call_state.call_type = extracted.get("callType", call_state.call_type)
                    logger.info(f"Post-call extraction complete: {json.dumps(call_state.intake_data)[:300]}")

        # 3) Generate summary if we don't have one
        if not call_state.summary and call_state.turns:
            transcript = "\n".join(
                f"{'Agent' if t['role'] == 'agent' else 'Caller'}: {t['content']}"
                for t in call_state.turns
            )
            call_state.summary = await generate_summary(transcript)

    except Exception as e:
        logger.error(f"Error extracting from context: {e}")


async def post_call_extraction(transcript: str, call_type: str) -> dict | None:
    """Use OpenAI to extract structured data from the call transcript."""
    import openai

    try:
        client = openai.AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

        fields_hint = ""
        if call_type in CALL_TYPE_FIELDS:
            field_names = [f["key"] for f in CALL_TYPE_FIELDS[call_type]]
            fields_hint = f"Expected fields for a {call_type} call: {', '.join(field_names)}"

        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": f"""You are a data extraction assistant. Extract structured information from this HVAC intake call transcript.

{fields_hint}

Respond with ONLY a JSON object:
{{
  "callType": "design|service|quote|emergency|general",
  "fields": {{"fieldKey": "extracted value", ...}},
  "callerName": "name or null",
  "callerEmail": "email or null",
  "callerAddress": "address or null",
  "summary": "Brief 2-3 sentence summary of the call"
}}"""
                },
                {"role": "user", "content": transcript},
            ],
            temperature=0,
        )

        text = response.choices[0].message.content.strip()
        # Strip markdown code fences if present
        if text.startswith("```"):
            text = text.split("\n", 1)[1] if "\n" in text else text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()

        return json.loads(text)
    except Exception as e:
        logger.error(f"Post-call extraction error: {e}")
        return None


async def generate_summary(transcript: str) -> str | None:
    """Generate a brief summary of the call."""
    import openai

    try:
        client = openai.AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "Summarize this HVAC intake call transcript in 2-3 sentences. Focus on what was discussed, what information was collected, and any next steps.",
                },
                {"role": "user", "content": transcript},
            ],
            temperature=0,
        )

        return response.choices[0].message.content.strip()
    except Exception as e:
        logger.error(f"Summary generation error: {e}")
        return None


async def save_call_data(call_state: CallState):
    """POST call data to the Next.js API for database storage and audit email."""
    # Guard against double-save and empty calls
    if call_state._saved:
        logger.info("Call data already saved, skipping duplicate")
        return
    if not call_state.turns:
        logger.info("No turns to save, skipping")
        return
    call_state._saved = True

    api_url = os.getenv("NEXTJS_API_URL", "http://localhost:3000")
    endpoint = f"{api_url}/api/call-complete"

    payload = call_state.to_payload()
    logger.info(f"Saving call data to {endpoint}: {json.dumps(payload, indent=2)[:500]}...")

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                endpoint,
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=aiohttp.ClientTimeout(total=30),
            ) as resp:
                if resp.status == 200:
                    result = await resp.json()
                    logger.info(f"Call data saved successfully: {result}")
                else:
                    error = await resp.text()
                    logger.error(f"Failed to save call data ({resp.status}): {error}")
    except Exception as e:
        logger.error(f"Error saving call data: {e}")


# ── Entry Point ────────────────────────────────────────────────────────────────

async def bot(
    runner_args: RunnerArguments,
    call_type: str | None = None,
    caller_name: str | None = None,
    direction: str = "inbound",
):
    """Main bot entry point. Called from server.py for each WebSocket connection."""

    _, call_data = await parse_telephony_websocket(runner_args.websocket)

    call_sid = call_data.get("call_id", "unknown")
    stream_sid = call_data.get("stream_id", "unknown")

    # Extract custom parameters passed via TwiML <Stream><Parameter>
    body_data = call_data.get("body", {})
    ws_call_type = body_data.get("call_type") or call_type
    ws_caller_name = body_data.get("caller_name") or caller_name
    ws_direction = body_data.get("direction") or direction
    caller_number = body_data.get("from_number", "unknown")

    logger.info(
        f"Bot starting: call_sid={call_sid}, stream_sid={stream_sid}, "
        f"type={ws_call_type}, direction={ws_direction}, caller={caller_number}"
    )

    call_state = CallState(
        call_sid=call_sid,
        caller_number=caller_number,
        direction=ws_direction,
        call_type=ws_call_type if ws_call_type and ws_call_type != "unknown" else None,
        caller_name=ws_caller_name,
    )

    serializer = TwilioFrameSerializer(
        stream_sid=stream_sid,
        call_sid=call_sid,
        account_sid=os.getenv("TWILIO_ACCOUNT_SID", ""),
        auth_token=os.getenv("TWILIO_AUTH_TOKEN", ""),
    )

    transport = FastAPIWebsocketTransport(
        websocket=runner_args.websocket,
        params=FastAPIWebsocketParams(
            audio_in_enabled=True,
            audio_out_enabled=True,
            add_wav_header=False,
            serializer=serializer,
        ),
    )

    await run_bot(transport, runner_args.handle_sigint, call_state)
