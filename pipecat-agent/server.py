"""
FastAPI server for the Pipecat HVAC voice agent.

Endpoints:
  - GET  /              Health check
  - WS   /ws            WebSocket endpoint for Twilio Media Streams (inbound + outbound)
  - POST /dial-out      Initiate an outbound call via Twilio (called from Next.js)
  - POST /twiml-incoming  TwiML for inbound calls (Twilio webhook)
"""

import os

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, Request
from fastapi.responses import HTMLResponse, JSONResponse
from loguru import logger
from twilio.rest import Client as TwilioClient
from twilio.twiml.voice_response import Connect, Stream, VoiceResponse

load_dotenv(override=True)

app = FastAPI(title="Elevate Edge Voice Agent")


def get_ws_url() -> str:
    """Get the WebSocket URL for Twilio Media Streams."""
    local_server_url = os.getenv("LOCAL_SERVER_URL", "")
    if not local_server_url:
        raise ValueError("LOCAL_SERVER_URL not configured")
    ws_url = local_server_url.replace("https://", "wss://").replace("http://", "ws://")
    return f"{ws_url}/ws"


@app.get("/")
async def health():
    return {"status": "ok", "service": "pipecat-voice-agent"}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """Handle WebSocket connections from Twilio Media Streams.

    Works for both inbound and outbound calls. The call metadata
    (call_type, caller_name, direction) is passed as <Parameter> tags
    in the TwiML <Stream> element.
    """
    from bot import bot
    from pipecat.runner.types import WebSocketRunnerArguments

    await websocket.accept()
    logger.info("WebSocket connection accepted")

    try:
        runner_args = WebSocketRunnerArguments(websocket=websocket)
        await bot(runner_args)
    except Exception as e:
        logger.error(f"Error in WebSocket handler: {e}")
    finally:
        try:
            await websocket.close()
        except Exception:
            pass


@app.post("/twiml-incoming")
async def twiml_incoming(request: Request):
    """Twilio webhook for inbound calls.

    Returns TwiML that connects the call to the Pipecat WebSocket.
    Configure your Twilio phone number webhook to point here:
      https://YOUR_NGROK_URL/twiml-incoming
    """
    try:
        ws_url = get_ws_url()
    except ValueError as e:
        logger.error(f"twiml-incoming error: {e}")
        resp = VoiceResponse()
        resp.say("We're sorry, the voice agent is not available right now. Please try again later.", voice="Polly.Joanna")
        resp.hangup()
        return HTMLResponse(content=str(resp), media_type="application/xml")

    # Parse caller info from Twilio form data
    form_data = await request.form()
    caller_number = form_data.get("From", "unknown")
    called_number = form_data.get("To", "unknown")
    call_sid = form_data.get("CallSid", "unknown")

    logger.info(f"Inbound call: {caller_number} -> {called_number} (SID: {call_sid})")

    response = VoiceResponse()
    connect = Connect()
    stream = Stream(url=ws_url)
    stream.parameter(name="direction", value="inbound")
    stream.parameter(name="from_number", value=str(caller_number))
    stream.parameter(name="to_number", value=str(called_number))
    connect.append(stream)
    response.append(connect)
    response.pause(length=300)

    return HTMLResponse(content=str(response), media_type="application/xml")


@app.post("/dial-out")
async def handle_dial_out(request: Request):
    """Initiate an outbound call. Called by the Next.js frontend.

    Expects JSON body:
    {
        "phoneNumber": "+1234567890",
        "callType": "design",  // optional
        "callerName": "John"   // optional
    }
    """
    data = await request.json()
    phone_number = data.get("phoneNumber")
    call_type = data.get("callType", "unknown")
    caller_name = data.get("callerName")

    if not phone_number:
        return JSONResponse(
            {"error": "phoneNumber is required"},
            status_code=400,
        )

    account_sid = os.getenv("TWILIO_ACCOUNT_SID")
    auth_token = os.getenv("TWILIO_AUTH_TOKEN")
    twilio_number = os.getenv("TWILIO_PHONE_NUMBER")

    if not account_sid or not auth_token or not twilio_number:
        return JSONResponse(
            {"error": "Twilio credentials not configured"},
            status_code=500,
        )

    try:
        ws_url = get_ws_url()
    except ValueError as e:
        return JSONResponse({"error": str(e)}, status_code=500)

    response = VoiceResponse()
    connect = Connect()
    stream = Stream(url=ws_url)
    stream.parameter(name="call_type", value=call_type or "unknown")
    stream.parameter(name="caller_name", value=caller_name or "")
    stream.parameter(name="direction", value="outbound")
    stream.parameter(name="from_number", value=twilio_number)
    stream.parameter(name="to_number", value=phone_number)
    connect.append(stream)
    response.append(connect)
    response.pause(length=300)

    twiml_str = str(response)
    logger.info(f"Dial-out TwiML: {twiml_str}")

    try:
        client = TwilioClient(account_sid, auth_token)
        call = client.calls.create(
            to=phone_number,
            from_=twilio_number,
            twiml=twiml_str,
        )
        logger.info(f"Outbound call initiated: {call.sid} to {phone_number}")

        return JSONResponse({
            "success": True,
            "callSid": call.sid,
            "status": call.status,
        })
    except Exception as e:
        logger.error(f"Dial-out error: {e}")
        return JSONResponse(
            {"error": str(e)},
            status_code=500,
        )


if __name__ == "__main__":
    port = int(os.getenv("PORT", "7860"))
    logger.info(f"Starting Elevate Edge voice agent on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
