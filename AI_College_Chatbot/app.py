import os
import json
from flask import Flask, request, jsonify, render_template, Response, stream_with_context
from dotenv import load_dotenv

import chatbot

load_dotenv()

app = Flask(__name__, template_folder="templates", static_folder="static")

@app.route("/")
def home():
    """Renders the primary chatbot UI template."""
    return render_template("index.html")


@app.route("/chat", methods=["POST"])
def chat():
    """Standard non-streaming endpoint with history support."""
    data = request.get_json(silent=True)

    if not data:
        return jsonify({"response": "No data received."}), 400

    message = data.get("message", "").strip()
    history = data.get("history", [])

    if not message:
        return jsonify({"response": "Please type a message."}), 400

    try:
        answer = chatbot.get_chat_response(message, history)
        return jsonify({"response": answer})
    except Exception as e:
        print(f"Error in /chat: {e}")
        fallback = chatbot.generate_fallback_response(message)
        return jsonify({"response": fallback})


@app.route("/chat/stream", methods=["POST"])
def chat_stream():
    """
    Server-Sent Events (SSE) streaming endpoint.
    Streams AI tokens in real-time for zero perceived lag.
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "No data received"}), 400

    message = data.get("message", "").strip()
    history = data.get("history", [])

    if not message:
        return jsonify({"error": "Message is empty"}), 400

    def generate():
        try:
            for chunk in chatbot.stream_chat_response(message, history):
                payload = json.dumps({"chunk": chunk})
                yield f"data: {payload}\n\n"
        except Exception as e:
            print(f"Error during stream generation: {e}")
            fallback = chatbot.generate_fallback_response(message)
            payload = json.dumps({"chunk": fallback})
            yield f"data: {payload}\n\n"
        finally:
            yield "data: [DONE]\n\n"

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive"
        }
    )


@app.route("/api/handbook", methods=["GET"])
def get_handbook():
    """Provides structured freshers handbook data for the quick-guide modal."""
    return jsonify(chatbot.get_college_handbook_data())


@app.route("/api/status", methods=["GET"])
def status():
    """Service health and model metadata check."""
    return jsonify({
        "status": "online",
        "service": "CampusPulse College AI Assistant",
        "has_nvidia_key": bool(chatbot.NVIDIA_API_KEY),
        "model": chatbot.ACTIVE_MODEL
    })


if __name__ == "__main__":
    app.run(
        debug=True,
        host="127.0.0.1",
        port=5000
    )