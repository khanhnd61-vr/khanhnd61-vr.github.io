// Local coding-agent benchmark (Nov 2026): a coding agent in VS Code builds the firmware images of an
// embedded Linux SDK (Qualcomm MDM9607, Yocto, kernel 4.14) from a fresh workspace, at most 10 prompts.
// Local models are served on 2x RTX 3090 (48 GB VRAM). Times are in seconds; prompts = 1 + additional prompts.
// Size is total-active parameters for mixture-of-experts models; VRAM a+b means GPU + system RAM.
window.AGENT_DATA = {
  models: [
    {
      id: 'opus', name: 'Opus 5.5 (baseline)', org: 'Anthropic', size: '-',
      built: true, result: '4,028 / 4,028 tasks', modelTime: 884, toolTime: 3785, hints: 0, prompts: 2,
      compactions: 1, toolCalls: 207, speed: null,
      backend: 'OpenRouter', quant: 'none', context: '-', vram: '-',
    },
    {
      id: 'qwen35', name: 'Qwen3.5-35B-A3B', org: 'Alibaba (Qwen)', size: '36B-A3B',
      built: false, result: '~1,349 / 4,028 tasks', modelTime: 3149, toolTime: 5389, hints: 9, prompts: 10,
      compactions: 7, toolCalls: 1586, speed: 31.6,
      backend: 'vLLM', quant: 'GPTQ-Int4', context: '262k', vram: '43.4 GiB',
    },
    {
      id: 'qwen3coder', name: 'Qwen3-Coder-Next', org: 'Alibaba (Qwen)', size: '80B-A3B',
      built: false, result: '~434 / 4,028 tasks', modelTime: 27120, toolTime: 34200, hints: 9, prompts: 10,
      compactions: 39, toolCalls: 7366, speed: 16.7,
      backend: 'llama.cpp', quant: 'Q4_K_M', context: '200k', vram: '48+13 GiB',
    },
    {
      id: 'qwen36', name: 'Qwen3.6-35B-A3B', org: 'Alibaba (Qwen)', size: '36B-A3B',
      built: false, result: '~2,070 / 4,028 tasks', modelTime: 8640, toolTime: 34620, hints: 7, prompts: 8,
      compactions: 30, toolCalls: 3613, speed: 32.7,
      backend: 'vLLM', quant: 'FP8', context: '262k', vram: '46.4 GiB',
    },
    {
      id: 'qwen38', name: 'Qwen3.8-27B', star: true, org: 'Alibaba (Qwen)', size: '28B',
      built: true, result: '4,028 / 4,028 tasks + recovery image', modelTime: 7697, toolTime: 7630, hints: 0, prompts: 1,
      compactions: 3, toolCalls: 536, speed: 22.5,
      backend: 'vLLM', quant: 'FP8', context: '180k', vram: '46.4 GiB',
    },
    {
      id: 'inkling2mini', name: 'Inkling 2 Mini', org: 'Thinking Machines', size: '26B-A3B',
      built: true, result: '4,028 / 4,028 tasks', modelTime: 28380, toolTime: 24120, hints: 6, prompts: 8,
      compactions: 8, toolCalls: 817, speed: 10.8,
      backend: 'llama.cpp', quant: 'IQ4_NL', context: '262k', vram: '~43 GiB',
    },
    {
      id: 'glm47flash', name: 'GLM-4.7-Flash', org: 'Z.ai (Zhipu)', size: '31B-A3B',
      built: false, result: '~419 tasks, kernel only', modelTime: 24540, toolTime: 15180, hints: 8, prompts: 10,
      compactions: 14, toolCalls: 3534, speed: 20.0,
      backend: 'llama.cpp', quant: 'UD-Q8_K_XL', context: '202k', vram: '41.9 GiB',
    },
    {
      id: 'museglimmer', name: 'Muse-Glimmer-30B', org: 'Meta', size: '30B',
      built: true, result: '4,015 / 4,015 tasks', modelTime: 8820, toolTime: 26580, hints: 4, prompts: 8,
      compactions: 25, toolCalls: 2491, speed: 14.6,
      backend: 'llama.cpp', quant: 'Q4_K_XL', context: '131k', vram: '~22 GiB',
    },
    {
      id: 'flint', name: 'Flint', org: 'Recursive', size: '40B-A2.5B',
      built: true, result: '4,028 / 4,028 tasks', modelTime: 22260, toolTime: 9300, hints: 4, prompts: 5,
      compactions: 10, toolCalls: 1274, speed: 44,
      backend: 'llama.cpp', quant: 'UD-Q6_K_XL', context: '262k', vram: '41.1 GiB',
    },
    {
      id: 'northminicode', name: 'North-Mini-Code 1.0', org: 'Cohere Labs', size: '31B MoE',
      built: false, result: 'no build task ran', modelTime: 4800, toolTime: 1020, hints: 7, prompts: 10,
      compactions: 2, toolCalls: 473, speed: 47,
      backend: 'llama.cpp', quant: 'UD-Q8_K_XL', context: '262k', vram: '38.5 GiB',
    },
    {
      id: 'devstral2', name: 'Devstral Small 2', org: 'Mistral AI', size: '24B',
      built: false, result: '~1,794 / 4,028 tasks', modelTime: 25260, toolTime: 5940, hints: 9, prompts: 10,
      compactions: 11, toolCalls: 3385, speed: 11.8,
      backend: 'llama.cpp', quant: 'UD-Q8_K_XL', context: '172k', vram: '43.3 GiB',
    },
    {
      id: 'deepseekv41', name: 'DeepSeek-V4.1-Flash Coder', org: 'DeepSeek, compressed by ISTA-DASLab', size: '763B MoE',
      built: true, result: '4,028 / 4,028 tasks', modelTime: 59160, toolTime: 11880, hints: 1, prompts: 2,
      compactions: 4, toolCalls: 1543, speed: 9.5,
      backend: 'llama.cpp', quant: 'IQ2_XXS', context: '524k', vram: '46+27 GiB',
    },
  ],
};
