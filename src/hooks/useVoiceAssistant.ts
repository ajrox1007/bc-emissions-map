"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface UseVoiceAssistantOptions {
  onTranscript?: (text: string) => void;
}

interface UseVoiceAssistantReturn {
  isListening: boolean;
  isPlaying: boolean;
  transcript: string;
  startListening: () => void;
  stopListening: () => void;
  speak: (text: string) => Promise<void>;
  stopSpeaking: () => void;
  isSupported: boolean;
}

const SAMPLE_RATE = 24000;

export function useVoiceAssistant(
  options: UseVoiceAssistantOptions = {}
): UseVoiceAssistantReturn {
  const [isListening, setIsListening] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [transcript, setTranscript] = useState("");

  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const stopFlagRef = useRef(false);

  // Keep callback in a ref so recognition always calls the latest version
  const onTranscriptRef = useRef(options.onTranscript);
  useEffect(() => {
    onTranscriptRef.current = options.onTranscript;
  }, [options.onTranscript]);

  // Check browser support
  const isSupported =
    typeof window !== "undefined" &&
    !!(
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition
    );

  // Get or create AudioContext
  const getAudioContext = useCallback(() => {
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      // Resume if suspended (browser autoplay policy)
      if (audioContextRef.current.state === "suspended") {
        audioContextRef.current.resume();
      }
      return audioContextRef.current;
    }
    const ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
    audioContextRef.current = ctx;
    return ctx;
  }, []);

  // Initialize SpeechRecognition
  const getRecognition = useCallback(() => {
    if (recognitionRef.current) return recognitionRef.current;
    if (!isSupported) return null;

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;

    recognitionRef.current = recognition;
    return recognition;
  }, [isSupported]);

  const startListening = useCallback(() => {
    const recognition = getRecognition();
    if (!recognition) return;

    setTranscript("");

    recognition.onresult = (event: any) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      const currentTranscript = finalTranscript || interimTranscript;
      setTranscript(currentTranscript);

      if (finalTranscript) {
        onTranscriptRef.current?.(finalTranscript.trim());
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    try {
      recognition.start();
      setIsListening(true);
    } catch (err) {
      console.error("Failed to start recognition:", err);
      setIsListening(false);
    }
  }, [getRecognition]);

  const stopListening = useCallback(() => {
    const recognition = recognitionRef.current;
    if (recognition) {
      try {
        recognition.stop();
      } catch (e) {
        // Already stopped
      }
    }
    setIsListening(false);
  }, []);

  const speak = useCallback(async (text: string) => {
    // Stop any current playback
    stopFlagRef.current = true;
    const ctx = getAudioContext();

    stopFlagRef.current = false;
    setIsPlaying(true);

    try {
      const response = await fetch("/api/murf-tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        console.error("TTS API error:", response.status, errData);
        throw new Error(errData.error || `TTS API error: ${response.status}`);
      }

      const contentType = response.headers.get("Content-Type") || "";

      if (contentType.includes("audio/pcm") && response.body) {
        // Stream PCM chunks and play them immediately via Web Audio API
        const reader = response.body.getReader();
        // Schedule audio slightly ahead to avoid gaps
        let nextStartTime = ctx.currentTime + 0.05;
        let totalSamples = 0;
        // Carry leftover byte when a chunk splits on an odd boundary
        let leftover: Uint8Array | null = null;

        while (true) {
          if (stopFlagRef.current) {
            reader.cancel();
            break;
          }

          const { done, value } = await reader.read();
          if (done) break;
          if (!value || value.length === 0) continue;

          // Merge leftover byte from previous chunk if present
          let chunk: Uint8Array;
          if (leftover) {
            chunk = new Uint8Array(leftover.length + value.length);
            chunk.set(leftover);
            chunk.set(value, leftover.length);
            leftover = null;
          } else {
            chunk = value;
          }

          // Save trailing odd byte for next iteration
          const usableBytes = chunk.length - (chunk.length % 2);
          if (chunk.length % 2 !== 0) {
            leftover = new Uint8Array(1);
            leftover[0] = chunk[chunk.length - 1];
          }

          if (usableBytes === 0) continue;

          // Convert Int16LE PCM to Float32 for Web Audio
          // Copy into a fresh ArrayBuffer so DataView offsets start at 0
          const aligned = chunk.slice(0, usableBytes);
          const sampleCount = usableBytes / 2;
          const float32 = new Float32Array(sampleCount);
          const dataView = new DataView(aligned.buffer, aligned.byteOffset, aligned.byteLength);
          for (let i = 0; i < sampleCount; i++) {
            float32[i] = dataView.getInt16(i * 2, true) / 32768;
          }

          // Create an AudioBuffer and schedule it
          const audioBuffer = ctx.createBuffer(1, sampleCount, SAMPLE_RATE);
          audioBuffer.getChannelData(0).set(float32);

          const source = ctx.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(ctx.destination);

          // Schedule playback at the right time
          const startTime = Math.max(nextStartTime, ctx.currentTime);
          source.start(startTime);

          nextStartTime = startTime + sampleCount / SAMPLE_RATE;
          totalSamples += sampleCount;
        }

        // Wait for all scheduled audio to finish playing
        if (totalSamples > 0 && !stopFlagRef.current) {
          const remainingTime = (nextStartTime - ctx.currentTime) * 1000;
          if (remainingTime > 0) {
            await new Promise<void>((resolve) => {
              const timer = setTimeout(resolve, remainingTime + 100);
              // Check stop flag periodically
              const check = setInterval(() => {
                if (stopFlagRef.current) {
                  clearTimeout(timer);
                  clearInterval(check);
                  resolve();
                }
              }, 100);
            });
          }
        }
      } else if (contentType.includes("audio/")) {
        // Fallback: MP3 blob playback
        const blob = await response.blob();
        const audioSrc = URL.createObjectURL(blob);
        const audio = new Audio(audioSrc);

        await new Promise<void>((resolve, reject) => {
          audio.onended = () => {
            URL.revokeObjectURL(audioSrc);
            resolve();
          };
          audio.onerror = (e) => {
            URL.revokeObjectURL(audioSrc);
            reject(e);
          };
          audio.play();
        });
      } else {
        // JSON fallback (base64 or URL)
        const data = await response.json();
        if (data.error) throw new Error(data.error);

        const audioSrc = data.audioContent
          ? `data:audio/mp3;base64,${data.audioContent}`
          : data.audioUrl;

        if (!audioSrc) throw new Error("No audio content received");

        const audio = new Audio(audioSrc);
        await new Promise<void>((resolve, reject) => {
          audio.onended = () => resolve();
          audio.onerror = (e) => reject(e);
          audio.play();
        });
      }
    } catch (err) {
      console.error("TTS playback error:", err);
    } finally {
      if (!stopFlagRef.current) {
        setIsPlaying(false);
      }
    }
  }, [getAudioContext]);

  const stopSpeaking = useCallback(() => {
    stopFlagRef.current = true;
    setIsPlaying(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // Already stopped
        }
      }
      stopFlagRef.current = true;
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close();
      }
    };
  }, []);

  return {
    isListening,
    isPlaying,
    transcript,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    isSupported,
  };
}
