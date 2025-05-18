from smolagents import LiteLLMModel

model = LiteLLMModel(
    model_id="ollama_chat/qwen2:7b",
    api_base="http://127.0.0.1:11434",
    num_ctx=8192,
)

while True:
    user_input = input("質問を入力してください（終了するには 'exit' と入力）：")
    if user_input.lower() == "exit":
        break

    messages = [
        {"role": "user", "content": [{"type": "text", "text": user_input}]}
    ]

    response = model(messages)
    print("AI:", response.content)