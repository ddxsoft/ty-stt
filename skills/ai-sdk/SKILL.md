---
name: ai-sdk
description: Build or modify AI SDK (Vercel) integrations in TypeScript apps. Use when requests mention AI SDK Core/UI, streamText/generateText/generateObject, useChat/useObject, tool calling, streaming, agents, embeddings/RAG, or selecting providers/models for React/Next.js/Vue/Svelte/Node.js.
---

# AI SDK

## Overview
Use the AI SDK to build AI powered apps and agents in TypeScript across React, Next.js, Vue, Svelte, and Node.js. Choose AI SDK Core for server side model calls and AI SDK UI for chat or generative UI hooks.

## Workflow Decision Tree
1) Identify runtime and framework (Next.js App Router, Node.js API, React UI, etc.).
2) Choose library:
   - Use AI SDK Core for server side generation, agents, tools, or embeddings.
   - Use AI SDK UI in addition to Core for chat or interactive UI.
3) Choose provider and model; set required API keys or AI Gateway key.
4) Implement server entrypoint:
   - Use `generateText` for one shot text.
   - Use `streamText` for streaming responses and UI message streaming.
   - Use `generateObject` for structured output.
   - Use `tool` definitions for tool calling.
5) Implement UI:
   - Use `useChat` or `useObject` from the framework package.
   - Configure the transport or endpoint if not using the default `/api/chat`.
6) Add advanced features: tool calling loops, embeddings/RAG, middleware, telemetry, or error handling.
7) Validate with a minimal request and add tests or logs if needed.

## Core Tasks

### Provider and model setup
- Confirm whether the user wants a single provider or AI Gateway.
- Keep model names and provider packages aligned with the docs.
- Store API keys in environment variables and avoid hard coding secrets.

### AI SDK Core patterns
- Use `generateText` for non streaming requests.
- Use `streamText` for streaming responses; return a UI message stream response when serving a client UI.
- Use `generateObject` to enforce schema structured output.
- Use `convertToModelMessages` when adapting UI messages to model messages.
- Add `tool` definitions for tool calling and multi step flows.

### AI SDK UI patterns
- Use `useChat` for chat interfaces; it sends messages to a server endpoint and streams responses.
- Use `useObject` for structured data streaming.
- Configure the transport or endpoint when not using the default route.

### RAG and embeddings
- Split source material into chunks before embedding.
- Store embeddings in a vector capable database and run similarity search before prompting.
- Add retrieved context to prompts before generation.

## References
- Read `references/introduction-summary.md` for the official intro and positioning.
- Read `references/ai-sdk-llms.txt` for detailed docs; use `rg` to locate topics (for example: "generateText", "streamText", "useChat", "embeddings").

## Trigger Examples
- "Add AI SDK useChat to my Next.js app."
- "Use AI SDK streamText with tool calling."
- "Generate structured JSON with generateObject."
- "Pick a provider and model for AI SDK."
- "Build RAG with AI SDK embeddings."
