# 模型连接说明

练途将“供应商预设”和“传输协议”分开保存。切换预设会填入推荐端点、协议和示例模型；用户仍可覆盖 Base URL、模型 ID 和请求头。

## 支持的协议

| 协议 | 推理端点 | 模型发现 | 图片格式 |
| --- | --- | --- | --- |
| OpenAI Chat Completions | `/chat/completions` | `/models` | `image_url` |
| OpenAI Responses | `/responses` | `/models` | `input_image` |
| Anthropic Messages | `/messages` | `/models` | base64 image source |
| Gemini GenerateContent | `/models/{model}:generateContent` | `/models` | `inline_data` |
| Ollama Chat | `/api/chat` | `/api/tags` | base64 `images` |

预设包括智谱、OpenAI、Anthropic、Gemini、DeepSeek、OpenRouter、硅基流动、Ollama 和 LM Studio。其他网关可选择“自定义”，再指定协议。

## 地址与端口

- 网页版通过练途服务端转发，只接受 HTTPS 公网地址，不访问本机或局域网地址。
- Android APK 使用原生 HTTP 客户端直连，允许 HTTPS，以及 `localhost`、私有 IPv4、`.local` 和 `host.docker.internal` 的 HTTP 地址。
- Ollama 默认 `http://127.0.0.1:11434`；LM Studio 常用 `http://127.0.0.1:1234/v1`。当模型服务运行在另一台电脑上时，应填写那台电脑的局域网 IP，而不是手机自己的 `127.0.0.1`。

## 自定义请求头

高级设置接受 JSON 对象，例如：

```json
{
  "HTTP-Referer": "https://example.com",
  "X-Title": "练途"
}
```

自定义请求头覆盖协议默认值；`Host`、`Content-Length` 和 `Connection` 不允许覆盖。API 密钥和自定义请求头只保存在当前设备的本地存储中。

## 设计参考

- Open WebUI：协议导向的 Ollama、OpenAI 兼容与 Open Responses 连接，并从连接中发现模型。
- Cherry Studio：供应商注册表、用户覆盖的 Base URL、自定义供应商、请求头和连接健康检查。
- 各协议请求体以 OpenAI、Anthropic、Google Gemini 与 Ollama 官方 API 文档为准。
