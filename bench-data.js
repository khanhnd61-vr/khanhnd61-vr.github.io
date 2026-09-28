// Measured latency for the hero "latency explorer".
//
// One result per (engine, model, device): the best reported number, which is
// also the most recent. Nothing here is estimated - a field that no report
// gives is null and shows as "not reported".
//
//   models:  image = input side in px (or a label), chunk = action steps per call,
//            views = camera views when fixed by the model
//   devices: note  = how that device's numbers were measured
//   results: [model, device, ms, memory, views, setup]
//            memory = { vram, rss } in MiB (either may be missing) or null
//            views  = camera views in the timed call, or null if not stated
//
// Sources
//   vla.cpp  README.md (RTX 5090), perf-v030.md (RTX 3060, Apple M4, OpenVINO),
//            docs/backend/metal.md (M5 Max), docs/backend/sycl.md (Arc A380),
//            eval/reports/report-{agx-orin,orin-nano}.md (Jetson)
//   vla.simd experiments/RESULTS.md, experiments/results/*, docs/14, docs/15, docs/19,
//            README.md and TURBOVLA.md (i5-12400F). Default release build only;
//            the opt-in asm kernels (-DVLA_ASM_I8 etc.) are faster but excluded.

window.BENCH_DATA = {
  'vla.cpp': {
    models: {
      smolvla: { name: 'SmolVLA',     image: 512, chunk: 50 },
      pi0:     { name: 'π0',          image: 224, chunk: 50 },
      pi05:    { name: 'π0.5',        image: 224, chunk: 50 },
      gr00t15: { name: 'GR00T N1.5',  image: 224, chunk: 16 },
      gr00t16: { name: 'GR00T N1.6',  image: 224, chunk: 50 },
      gr00t17: { name: 'GR00T N1.7',  image: 256, chunk: 40 },
      bitvla:  { name: 'BitVLA',      image: 224, chunk: 8 },
      evo1:    { name: 'Evo-1',       image: 448, chunk: 50 },
      adapter: { name: 'VLA-Adapter', image: 224, chunk: 8 },
      oft:     { name: 'OpenVLA-OFT', image: 224, chunk: 8 },
      jepa:    { name: 'VLA-JEPA',    image: 256, chunk: 7 },
    },
    devices: {
      rtx5090:  { name: 'NVIDIA RTX 5090',          note: 'CUDA 13.2. vla-bench, engine only: p50 of 20 reps after 3 warmups, best of three sweeps.' },
      rtx3060:  { name: 'NVIDIA RTX 3060 12 GB',    note: 'CUDA 12.8. vla-bench, engine only: mean of 20 reps after 3 warmups, fastest flags per model. Memory: peak VRAM and host RSS.' },
      m5max:    { name: 'Apple M5 Max',             note: 'Metal, 64 GB unified. vla-bench, engine only: p50 of 20 reps after 3 warmups, best of three sweeps.' },
      m4:       { name: 'Apple M4',                 note: 'Metal, 24 GB unified. vla-bench, engine only: mean of 20 reps after 3 warmups, fastest flags per model. Memory: peak process RSS.' },
      arcb390:  { name: 'Intel Arc B390 iGPU',      note: 'OpenVINO GPU on a Core Ultra X7 358H. vla_predict_check, one view: best of 4-6 iterations after 3 warmups.' },
      aiboost:  { name: 'Intel AI Boost NPU',       note: 'OpenVINO NPU on a Core Ultra X7 358H. vla_predict_check, one view: best of 4-6 iterations after 3 warmups.' },
      x7cpu:    { name: 'Intel Core Ultra X7 358H', note: 'CPU only, best of the ggml CPU backend and the OpenVINO CPU plugin. vla_predict_check, one view: best of 4-6 iterations.' },
      a380:     { name: 'Intel Arc A380',           note: 'SYCL. vla_predict_check with fixed noise: best of 5-10 iterations after 3 warmups.' },
      ryzen5:   { name: 'AMD Ryzen 5 5500',         note: 'ggml CPU backend, 8 threads. vla_predict_check with fixed noise: best of 5-10 iterations after 3 warmups.' },
      agxorin:  { name: 'NVIDIA Jetson AGX Orin',   note: 'CUDA. vla-server during a LIBERO-Object run: mean server-side time per call (vision + inference). Memory not isolated on unified memory.' },
      orinnano: { name: 'NVIDIA Jetson Orin Nano',  note: 'CUDA. vla-server during a LIBERO-Object run: mean server-side time per call (vision + inference). Memory not isolated on unified memory.' },
    },
    results: [
      // RTX 5090 - README.md
      ['adapter', 'rtx5090', 19.8, null, 1, 'defaults'],
      ['jepa',    'rtx5090', 21.5, null, 1, 'defaults'],
      ['bitvla',  'rtx5090', 25.3, null, 1, 'defaults'],
      ['gr00t15', 'rtx5090', 29.4, null, 1, 'defaults'],
      ['gr00t17', 'rtx5090', 33.4, null, 1, 'defaults'],
      ['gr00t16', 'rtx5090', 35.7, null, 1, 'defaults'],
      ['oft',     'rtx5090', 49.2, null, 1, 'defaults'],
      ['smolvla', 'rtx5090', 49.6, null, 2, 'defaults'],
      ['pi0',     'rtx5090', 52.1, null, 2, 'defaults'],
      ['evo1',    'rtx5090', 55.2, null, 1, 'defaults'],
      ['pi05',    'rtx5090', 56.1, null, 2, 'defaults'],

      // RTX 3060 - perf-v030.md (OpenVLA-OFT does not fit in 12 GB)
      ['bitvla',  'rtx3060',  59.8, { vram: 1312, rss: 1072 }, 1, 'bf16 weights'],
      ['jepa',    'rtx3060',  62.8, { vram: 3986, rss: 627 },  1, 'defaults'],
      ['adapter', 'rtx3060',  79.9, { vram: 2864, rss: 1063 }, 1, 'defaults'],
      ['gr00t16', 'rtx3060',  89.1, { vram: 5918, rss: 1441 }, 1, 'defaults'],
      ['gr00t17', 'rtx3060',  91.4, { vram: 6288, rss: 1417 }, 1, 'defaults'],
      ['gr00t15', 'rtx3060',  93.1, { vram: 4830, rss: 1436 }, 1, 'defaults'],
      ['smolvla', 'rtx3060',  97.1, { vram: 1322, rss: 735 },  2, 'flash-attn'],
      ['evo1',    'rtx3060', 178.6, { vram: 1574, rss: 822 },  1, 'bf16 act + flash-attn'],
      ['pi0',     'rtx3060', 203.0, { vram: 5480, rss: 833 },  2, 'bf16 act + flash-attn'],
      ['pi05',    'rtx3060', 254.0, { vram: 5938, rss: 729 },  2, 'defaults'],

      // Apple M5 Max - docs/backend/metal.md (BitVLA has no Metal path)
      ['adapter', 'm5max',  64.8, null, 1, 'defaults'],
      ['jepa',    'm5max',  75.1, null, 1, 'defaults'],
      ['gr00t15', 'm5max', 104.3, null, 1, 'defaults'],
      ['smolvla', 'm5max', 115.2, null, 2, 'defaults'],
      ['gr00t17', 'm5max', 128.4, null, 1, 'defaults'],
      ['gr00t16', 'm5max', 133.3, null, 1, 'defaults'],
      ['oft',     'm5max', 184.2, null, 1, 'defaults'],
      ['evo1',    'm5max', 215.0, null, 1, 'defaults'],
      ['pi0',     'm5max', 220.8, null, 2, 'defaults'],
      ['pi05',    'm5max', 237.5, null, 2, 'defaults'],

      // Apple M4 - perf-v030.md
      ['jepa',    'm4',  257.2, { rss: 4034 },  1, 'defaults'],
      ['smolvla', 'm4',  326.9, { rss: 1380 },  2, 'flash-attn'],
      ['adapter', 'm4',  330.0, { rss: 3697 },  1, 'defaults'],
      ['gr00t17', 'm4',  382.4, { rss: 7442 },  1, 'defaults'],
      ['gr00t16', 'm4',  389.0, { rss: 7144 },  1, 'defaults'],
      ['gr00t15', 'm4',  422.6, { rss: 6841 },  1, 'defaults'],
      ['evo1',    'm4',  775.2, { rss: 1620 },  1, 'flash-attn'],
      ['pi0',     'm4', 1121.9, { rss: 5530 },  2, 'flash-attn'],
      ['pi05',    'm4', 1194.2, { rss: 5987 },  2, 'defaults'],
      ['oft',     'm4', 1681.4, { rss: 15457 }, 1, 'defaults'],

      // Core Ultra X7 358H - perf-v030.md / docs/backend/ov.md
      ['jepa',    'arcb390', 127, null, 1, 'OpenVINO'],
      ['gr00t15', 'arcb390', 148, null, 1, 'OpenVINO'],
      ['adapter', 'arcb390', 161, null, 1, 'OpenVINO'],
      ['gr00t17', 'arcb390', 288, null, 1, 'OpenVINO'],
      ['gr00t16', 'arcb390', 323, null, 1, 'OpenVINO'],
      ['smolvla', 'arcb390', 451, null, 1, 'OpenVINO'],
      ['evo1',    'arcb390', 563, null, 1, 'OpenVINO'],
      ['pi05',    'arcb390', 683, null, 1, 'OpenVINO'],
      ['pi05',    'aiboost', 916,  null, 1, 'OpenVINO'],
      ['smolvla', 'aiboost', 1162, null, 1, 'OpenVINO'],
      ['jepa',    'x7cpu', 1046, null, 1, 'ggml CPU'],
      ['gr00t17', 'x7cpu', 1146, null, 1, 'ggml CPU'],
      ['adapter', 'x7cpu', 1228, null, 1, 'ggml CPU'],
      ['gr00t16', 'x7cpu', 1276, null, 1, 'ggml CPU'],
      ['smolvla', 'x7cpu', 1340, null, 1, 'OpenVINO CPU'],
      ['gr00t15', 'x7cpu', 1420, null, 1, 'ggml CPU'],
      ['pi05',    'x7cpu', 2802, null, 1, 'ggml CPU'],
      ['evo1',    'x7cpu', 3114, null, 1, 'ggml CPU'],

      // Arc A380 + its Ryzen 5 5500 host - docs/backend/sycl.md
      ['adapter', 'a380',    517, null, null, 'defaults'],
      ['smolvla', 'a380',    528, null, null, 'f32 weights'],
      ['evo1',    'a380',   1176, null, null, 'defaults'],
      ['smolvla', 'ryzen5', 1920, null, null, '8 threads'],
      ['adapter', 'ryzen5', 2994, null, null, '8 threads'],
      ['evo1',    'ryzen5', 7695, null, null, '8 threads'],

      // Jetson - eval/reports (server-side total per call)
      ['smolvla', 'agxorin',  205.95, null, null, 'defaults'],
      ['gr00t17', 'agxorin',  367.43, null, null, 'defaults'],
      ['gr00t16', 'agxorin',  367.73, null, null, 'defaults'],
      ['gr00t15', 'agxorin',  409.57, null, null, 'defaults'],
      ['pi0',     'agxorin',  580.22, null, null, 'defaults'],
      ['bitvla',  'agxorin',  717.55, null, null, 'defaults'],
      ['evo1',    'agxorin',  996.05, null, null, 'defaults'],
      ['smolvla', 'orinnano',  509.60, null, null, 'defaults'],
      ['gr00t15', 'orinnano', 1182.67, null, null, 'defaults'],
      ['pi0',     'orinnano', 1484.75, null, null, 'defaults'],
      ['bitvla',  'orinnano', 2710.95, null, null, 'defaults'],
      ['evo1',    'orinnano', 3551.56, null, null, 'defaults'],
    ],
  },

  // CPU only. Every figure is an engine-only median: preprocessing through
  // un-normalized actions, no transport. int8 is opt-in and lossy (see README).
  'vla.simd': {
    models: {
      impact:    { name: 'IMPACT',                     image: '480×640', views: 2, chunk: 50 },
      act:       { name: 'ACT',                        image: '480×640', views: 2, chunk: 100 },
      inflect:   { name: 'INFLECT',                    image: '480×640', views: 2, chunk: 50 },
      octo:      { name: 'Octo-Small',                 image: '256 + 128', views: 2, chunk: 4 },
      turbovla:  { name: 'TurboVLA',                   image: 256, views: 2, chunk: 12 },
      microvla:  { name: 'MicroVLA',                   image: 224, views: 2, chunk: 12 },
      smolvla:   { name: 'SmolVLA (450M)',             image: 512, views: 2, chunk: 50 },
      smolvlap6: { name: 'SmolVLA (pruned)',           image: 512, views: 2, chunk: 50 },
      dp:        { name: 'Diffusion Policy (DDIM-10)', image: '480×640', views: '2 × 2 frames', chunk: 32 },
    },
    devices: {
      pi5:    { name: 'Raspberry Pi 5',           note: '4× Cortex-A76 @ 2.4 GHz, NEON (+SDOT for int8). Engine-only median, cool board; sustained load adds 12-33%. Memory: peak process RSS.' },
      m4:     { name: 'Apple M4 (Mac mini)',      note: '4P + 6E cores, 24 GB, NEON. Engine-only median of warm reps. Memory: peak process RSS.' },
      i9:     { name: 'Intel Core i9-14900HX',    note: '8P + 16E cores, AVX2 (+AVX-VNNI for int8). Engine-only median of warm reps. Memory: peak process RSS.' },
      ryzen5: { name: 'AMD Ryzen 5 5500',         note: 'Zen 3, 6 cores / 12 threads, AVX2, no AVX-VNNI so fp32 only. Engine-only median of warm reps. Memory: peak process RSS.' },
      i5:     { name: 'Intel Core i5-12400F',     note: '6 P-cores / 12 threads, AVX2 + AVX-VNNI. Engine-only median, from the README latency table.' },
    },
    results: [
      ['impact', 'i9',      65.9, { rss: 589 }, null, 'int8 · 8 threads'],
      ['impact', 'm4',      90.9, null,         null, 'int8 (conv)'],
      ['impact', 'i5',      98,   null,         null, 'int8 · 6 threads'],
      ['impact', 'ryzen5', 187.9, null,         null, 'fp32 · 12 threads'],
      ['impact', 'pi5',    429.4, null,         null, 'int8 · 4 threads'],

      ['act', 'i9',      54.5, { rss: 305 },   null, 'int8 · 8 threads'],
      ['act', 'm4',      67.9, null,           null, 'int8 (conv)'],
      ['act', 'i5',     128,   null,           null, 'fp32 · 6 threads'],
      ['act', 'ryzen5', 155.3, { rss: 405 },   null, 'fp32 · 12 threads'],
      ['act', 'pi5',    358.8, { rss: 301.5 }, null, 'int8 · 4 threads'],

      ['inflect', 'i9',     150.1, { rss: 753.1 }, null, 'fp32 · 16 threads'],
      ['inflect', 'm4',     180.5, { rss: 837.2 }, null, 'fp32 · 8 threads'],
      ['inflect', 'ryzen5', 262.6, null,           null, 'fp32 · 12 threads'],
      ['inflect', 'pi5',   1529.4, null,           null, 'fp32 · 4 threads'],

      ['octo', 'i9',      39.5, { rss: 645 }, null, 'int8 · 8 threads'],
      ['octo', 'm4',      52.9, { rss: 678 }, null, 'fp32 · 8 threads'],
      ['octo', 'ryzen5',  75.4, null,         null, 'fp32 · 12 threads'],
      ['octo', 'i5',      83,   null,         null, 'fp32 · 12 threads'],
      ['octo', 'pi5',    306.8, null,         null, 'int8'],

      ['turbovla', 'm4',     137.0, { rss: 1641.6 }, null, 'fp32 · 8 threads'],
      ['turbovla', 'i5',     176.2, null,            null, 'fp32 · 12 threads'],
      ['turbovla', 'i9',     202.4, null,            null, 'fp32 · 16 threads'],
      ['turbovla', 'ryzen5', 211.4, { rss: 1624 },   null, 'fp32 · 12 threads'],
      ['turbovla', 'pi5',   1191.9, { rss: 1625 },   null, 'fp32 · 4 threads'],

      ['microvla', 'm4',     113.5, { rss: 1112 }, null, 'fp32 · 8 threads'],
      ['microvla', 'i9',     172.1, { rss: 1108 }, null, 'fp32 · 16 threads'],
      ['microvla', 'ryzen5', 174.5, { rss: 1110 }, null, 'fp32 · 12 threads'],
      ['microvla', 'pi5',    959.9, { rss: 1110 }, null, 'fp32 · 4 threads'],

      ['smolvla', 'i9',      469.9, { rss: 2823.1 }, null, 'int8 · 8 threads'],
      ['smolvla', 'm4',      679.9, { rss: 2459 },   null, 'fp32 · 8 threads'],
      ['smolvla', 'ryzen5', 1314.1, { rss: 2907 },   null, 'fp32 · 12 threads'],
      ['smolvla', 'pi5',    8187.5, { rss: 1448.5 }, null, 'fp32 · 4 threads'],

      ['smolvlap6', 'm4',   511.2, { rss: 1159.7 }, null, 'fp32 · 8 threads'],
      ['smolvlap6', 'pi5', 3029.6, { rss: 719.8 },  null, 'int8 · 4 threads'],

      ['dp', 'i9',      456.7, { rss: 2149.6 }, null, 'fp32 · 16 threads'],
      ['dp', 'm4',      547.6, { rss: 2224.2 }, null, 'fp32 · 8 threads'],
      ['dp', 'ryzen5', 1085.0, null,            null, 'fp32 · 12 threads'],
      ['dp', 'pi5',    4785.9, null,            null, 'fp32 · 4 threads'],
    ],
  },
};
