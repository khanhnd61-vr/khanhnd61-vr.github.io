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
//            memory = { vram, shared, rss } in MiB (any may be missing) or null;
//                     shared = device buffers in memory shared with the CPU (iGPU, NPU)
//            views  = camera views in the timed call, or null if not stated
//
// Sources
//   vla.cpp  docs/benchmark/*.md, one vla-bench round at commit c93ca0a (llama.cpp b11223;
//            the Core Ultra X7 358H at 450992c, c93ca0a plus an OpenVINO fix): mean
//            latency and peak memory from each report's "Fastest configuration" table.
//            RTX 5090 is the PR #32 author's min at defaults. M5 Max is not in that
//            round, so it is kept from an earlier build: docs/backend/metal.md.
//   vla.simd docs/benchmark/*.md, one round at commit 7636baa: median latency and
//            peak RSS of the faster of FP32 and INT8 at the fastest measured threads.

window.BENCH_DATA = {
  'vla.cpp': {
    models: {
      smolvla:  { name: 'SmolVLA',     image: 512, chunk: 50 },
      pi0:      { name: 'π0',          image: 224, chunk: 50 },
      pi05:     { name: 'π0.5',        image: 224, chunk: 50 },
      gr00t15:  { name: 'GR00T N1.5',  image: 224, chunk: 16 },
      gr00t16:  { name: 'GR00T N1.6',  image: 224, chunk: 50 },
      gr00t17:  { name: 'GR00T N1.7',  image: 256, chunk: 40 },
      bitvla:   { name: 'BitVLA',      image: 224, chunk: 8 },
      evo1:     { name: 'Evo-1',       image: 448, chunk: 50 },
      adapter:  { name: 'VLA-Adapter', image: 224, chunk: 8 },
      oft:      { name: 'OpenVLA-OFT', image: 224, chunk: 8 },
      jepa:     { name: 'VLA-JEPA',    image: 256, chunk: 7 },
      octo:     { name: 'Octo-Small',  image: '256 + 128', chunk: 4 },
      turbovla: { name: 'TurboVLA',    image: 256, chunk: 12 },
    },
    devices: {
      rtx5090:  { name: 'NVIDIA RTX 5090',               note: 'CUDA 13.2. Reported by the PR #32 author and not re-measured: vla-bench, engine only, minimum over 5 rounds at default flags. Memory not reported.' },
      rtx3090:  { name: 'NVIDIA RTX 3090',               note: 'CUDA 12.8. vla-bench, engine only: mean of 20 reps after 3 warmups, best of 3 processes, fastest flags per model. Memory: peak VRAM and host RSS.' },
      rtx5070l: { name: 'NVIDIA RTX 5070 Laptop',        note: 'CUDA 12.8, 8 GB, laptop on AC power. vla-bench, engine only: mean of 20 reps after 3 warmups, best of 3 processes, fastest flags per model. Memory: peak VRAM and host RSS.' },
      rtx3060:  { name: 'NVIDIA RTX 3060 12 GB',         note: 'CUDA 12.8. vla-bench, engine only: mean of 20 reps after 3 warmups, best of 3 processes, fastest flags per model. Memory: peak VRAM and host RSS.' },
      agxorin:  { name: 'NVIDIA Jetson AGX Orin',        note: 'CUDA 12.6, 64 GB unified, MAXN. vla-bench, engine only: mean of 20 reps after 3 warmups, best of 3 processes, fastest flags per model. Memory: peak RSS, which on unified memory includes the CUDA buffers.' },
      orinnano: { name: 'NVIDIA Jetson Orin Nano Super', note: 'CUDA 12.6, 8 GB unified, MAXN_SUPER. vla-bench, engine only: mean of 20 reps after 3 warmups, best of 3 processes, fastest flags per model. Memory: peak RSS, which on unified memory includes the CUDA buffers.' },
      m5max:    { name: 'Apple M5 Max',                  note: 'Metal, 64 GB unified. Earlier build (llama.cpp b10331), not in the latest round. vla-bench, engine only: p50 of 20 reps after 3 warmups, best of three sweeps, default flags.' },
      m4:       { name: 'Apple M4',                      note: 'Metal, 24 GB unified. vla-bench, engine only: mean of 20 reps after 3 warmups, best of 3 processes, fastest flags per model. Memory: peak RSS, including the Metal buffers.' },
      arcb390:  { name: 'Intel Arc B390 iGPU',           note: 'OpenVINO 2026.4 GPU plugin on a Core Ultra X7 358H, 25 W long-term power limit. vla-bench, engine only: mean of 20 reps after 3 warmups, best of 3 processes, fastest flags per model. Memory: peak device buffers in shared memory, and peak RSS.' },
      aiboost:  { name: 'Intel AI Boost NPU',            note: 'OpenVINO 2026.4 NPU plugin on a Core Ultra X7 358H; the NPU compiler rejects the other archs. vla-bench, engine only: mean of 20 reps after 3 warmups, best of 3 processes, fastest flags per model. Memory: peak device buffers in shared memory, and peak RSS.' },
      a380:     { name: 'Intel Arc A380',                note: 'SYCL, oneAPI 2025.3. vla-bench, engine only: mean of 20 reps after 3 warmups, best of 3 processes, fastest flags per model. Memory: peak VRAM and host RSS.' },
      hexagon:  { name: 'Snapdragon X Hexagon NPU',      note: 'Hexagon v73 NPU on Windows 11; ops it rejects fall back to the Oryon CPU. vla-bench, engine only: mean of 20 reps after 3 warmups, best of 3 processes, fastest flags per model. Memory: peak working set.' },
      i7:       { name: 'Intel Core i7-14700F',          note: 'ggml CPU backend, 16 threads, 65 W long-term power limit. vla-bench, engine only: mean of 20 reps after 3 warmups, best of 3 processes, fastest flags per model. Memory: peak RSS.' },
      i9:       { name: 'Intel Core i9-14900HX',         note: 'ggml CPU backend, 16 threads, laptop on AC power. vla-bench, engine only: mean of 20 reps after 3 warmups, best of 3 processes, fastest flags per model. Memory: peak RSS.' },
      x7cpu:    { name: 'Intel Core Ultra X7 358H',      note: 'ggml CPU backend, 16 threads, 25 W long-term power limit; faster than the OpenVINO CPU plugin on every model. vla-bench, engine only: mean of 20 reps after 3 warmups, best of 3 processes, fastest flags per model. Memory: peak RSS.' },
      i5:       { name: 'Intel Core i5-12400F',          note: 'ggml CPU backend, 12 threads. vla-bench, engine only: mean of 20 reps after 3 warmups, best of 3 processes, fastest flags per model. Memory: peak RSS.' },
      ryzen5:   { name: 'AMD Ryzen 5 5500',              note: 'ggml CPU backend, 12 threads. vla-bench, engine only: mean of 20 reps after 3 warmups, best of 3 processes, fastest flags per model. Memory: peak RSS.' },
      oryon:    { name: 'Snapdragon X Oryon CPU',        note: 'ggml CPU backend, 8 threads, Windows 11 on the Balanced power plan. vla-bench, engine only: mean of 20 reps after 3 warmups, best of 3 processes, fastest flags per model. Memory: peak working set.' },
    },
    results: [
      // RTX 5090 - rtx-5090.md (PR #32 author's numbers, min at defaults)
      ['octo',     'rtx5090', 2.69, null, 2, 'defaults'],
      ['turbovla', 'rtx5090', 4.88, null, 2, 'defaults'],
      ['jepa',     'rtx5090', 14.3, null, 1, 'defaults'],
      ['adapter',  'rtx5090', 16.0, null, 1, 'defaults'],
      ['gr00t15',  'rtx5090', 16.1, null, 1, 'defaults'],
      ['gr00t16',  'rtx5090', 19.4, null, 1, 'defaults'],
      ['gr00t17',  'rtx5090', 19.5, null, 1, 'defaults'],
      ['bitvla',   'rtx5090', 20.8, null, 1, 'defaults'],
      ['pi0',      'rtx5090', 28.8, null, 2, 'defaults'],
      ['pi05',     'rtx5090', 29.2, null, 2, 'defaults'],
      ['oft',      'rtx5090', 34.5, null, 1, 'defaults'],
      ['smolvla',  'rtx5090', 38.2, null, 2, 'defaults'],
      ['evo1',     'rtx5090', 49.1, null, 1, 'defaults'],

      // RTX 3090 - rtx-3090.md
      ['octo',     'rtx3090', 4.4, { vram: 810, rss: 501 }, 2, 'defaults'],
      ['turbovla', 'rtx3090', 5.8, { vram: 714, rss: 577 }, 2, 'f16 weights + flash-attn'],
      ['jepa',     'rtx3090', 23.8, { vram: 4148, rss: 618 }, 1, 'f16 weights'],
      ['bitvla',   'rtx3090', 27.1, { vram: 1460, rss: 1180 }, 1, 'defaults'],
      ['adapter',  'rtx3090', 29.5, { vram: 3034, rss: 1064 }, 1, 'f16 weights + flash-attn'],
      ['gr00t15',  'rtx3090', 30.6, { vram: 3802, rss: 612 }, 1, 'f16 weights + flash-attn'],
      ['gr00t16',  'rtx3090', 33.7, { vram: 4852, rss: 633 }, 1, 'f16 weights + flash-attn'],
      ['gr00t17',  'rtx3090', 33.9, { vram: 5210, rss: 638 }, 1, 'f16 weights + flash-attn'],
      ['smolvla',  'rtx3090', 47.9, { vram: 1402, rss: 737 }, 2, 'flash-attn + mm-prec default'],
      ['pi0',      'rtx3090', 77.1, { vram: 5706, rss: 642 }, 2, 'f16 weights + flash-attn'],
      ['evo1',     'rtx3090', 82.8, { vram: 1720, rss: 650 }, 1, 'f16 weights + flash-attn'],
      ['pi05',     'rtx3090', 84.6, { vram: 5880, rss: 658 }, 2, 'f16 weights'],
      ['oft',      'rtx3090', 88.9, { vram: 14770, rss: 1037 }, 1, 'f16 weights'],

      // RTX 5070 Laptop - rtx-5070-laptop.md (OpenVLA-OFT does not fit in 8 GB)
      ['octo',     'rtx5070l', 4.7, { vram: 734, rss: 590 }, 2, 'flash-attn'],
      ['turbovla', 'rtx5070l', 9.1, { vram: 586, rss: 642 }, 2, 'f16 weights + flash-attn'],
      ['jepa',     'rtx5070l', 40.8, { vram: 4006, rss: 728 }, 1, 'defaults'],
      ['adapter',  'rtx5070l', 53.6, { vram: 2894, rss: 1071 }, 1, 'f16 weights + flash-attn'],
      ['bitvla',   'rtx5070l', 60.0, { vram: 1328, rss: 1178 }, 1, 'defaults'],
      ['gr00t15',  'rtx5070l', 64.8, { vram: 3670, rss: 688 }, 1, 'f16 weights + flash-attn'],
      ['smolvla',  'rtx5070l', 65.3, { vram: 1238, rss: 810 }, 2, 'flash-attn + mm-prec default'],
      ['gr00t17',  'rtx5070l', 68.0, { vram: 5064, rss: 750 }, 1, 'defaults'],
      ['gr00t16',  'rtx5070l', 72.3, { vram: 4708, rss: 740 }, 1, 'defaults'],
      ['evo1',     'rtx5070l', 141.8, { vram: 1558, rss: 729 }, 1, 'f16 weights + flash-attn'],
      ['pi0',      'rtx5070l', 149.0, { vram: 5548, rss: 716 }, 2, 'f16 weights + flash-attn'],
      ['pi05',     'rtx5070l', 161.0, { vram: 5752, rss: 733 }, 2, 'f16 weights + flash-attn'],

      // RTX 3060 - rtx-3060.md (OpenVLA-OFT does not fit in 12 GB)
      ['octo',     'rtx3060', 8.3, { vram: 626, rss: 501 }, 2, 'defaults'],
      ['turbovla', 'rtx3060', 13.7, { vram: 616, rss: 578 }, 2, 'f16 weights + flash-attn'],
      ['jepa',     'rtx3060', 47.6, { vram: 3974, rss: 622 }, 1, 'f16 weights + flash-attn'],
      ['bitvla',   'rtx3060', 59.8, { vram: 1308, rss: 1180 }, 1, 'defaults'],
      ['adapter',  'rtx3060', 66.3, { vram: 2864, rss: 1064 }, 1, 'f16 weights'],
      ['gr00t17',  'rtx3060', 68.8, { vram: 5036, rss: 637 }, 1, 'f16 weights + flash-attn'],
      ['gr00t15',  'rtx3060', 69.9, { vram: 3630, rss: 612 }, 1, 'f16 weights + flash-attn'],
      ['gr00t16',  'rtx3060', 72.6, { vram: 4684, rss: 633 }, 1, 'f16 weights + flash-attn'],
      ['smolvla',  'rtx3060', 92.7, { vram: 1228, rss: 727 }, 2, 'flash-attn + mm-prec default'],
      ['pi0',      'rtx3060', 172.3, { vram: 5534, rss: 641 }, 2, 'f16 weights + flash-attn'],
      ['evo1',     'rtx3060', 176.8, { vram: 1566, rss: 816 }, 1, 'bf16 act + flash-attn'],
      ['pi05',     'rtx3060', 191.7, { vram: 5728, rss: 657 }, 2, 'f16 weights'],

      // Jetson AGX Orin - jetson-agx-orin.md
      ['octo',     'agxorin', 23.9, { rss: 947 }, 2, 'defaults'],
      ['turbovla', 'agxorin', 26.6, { rss: 932 }, 2, 'bf16 weights + flash-attn'],
      ['jepa',     'agxorin', 85.6, { rss: 4346 }, 1, 'f16 weights + flash-attn'],
      ['adapter',  'agxorin', 117.8, { rss: 3699 }, 1, 'f16 weights + flash-attn'],
      ['gr00t15',  'agxorin', 124.0, { rss: 4007 }, 1, 'f16 weights + flash-attn'],
      ['gr00t17',  'agxorin', 125.9, { rss: 5441 }, 1, 'f16 weights + flash-attn'],
      ['gr00t16',  'agxorin', 128.7, { rss: 5077 }, 1, 'f16 weights'],
      ['bitvla',   'agxorin', 134.7, { rss: 2219 }, 1, 'defaults'],
      ['smolvla',  'agxorin', 147.0, { rss: 1711 }, 2, 'flash-attn + mm-prec default'],
      ['pi0',      'agxorin', 301.2, { rss: 6017 }, 2, 'bf16 act + flash-attn'],
      ['evo1',     'agxorin', 311.4, { rss: 2154 }, 1, 'bf16 act + flash-attn'],
      ['oft',      'agxorin', 345.9, { rss: 15392 }, 1, 'f16 weights'],
      ['pi05',     'agxorin', 353.1, { rss: 6008 }, 2, 'defaults'],

      // Jetson Orin Nano Super - jetson-orin-nano.md (OpenVLA-OFT does not fit in 8 GB)
      ['octo',     'orinnano', 34.4, { rss: 923 }, 2, 'defaults'],
      ['turbovla', 'orinnano', 53.1, { rss: 895 }, 2, 'bf16 weights + flash-attn'],
      ['jepa',     'orinnano', 174.8, { rss: 4318 }, 1, 'f16 weights + flash-attn'],
      ['gr00t17',  'orinnano', 255.0, { rss: 5409 }, 1, 'f16 weights + flash-attn'],
      ['adapter',  'orinnano', 266.6, { rss: 3668 }, 1, 'f16 weights'],
      ['gr00t16',  'orinnano', 272.6, { rss: 5051 }, 1, 'defaults'],
      ['smolvla',  'orinnano', 287.8, { rss: 1676 }, 2, 'flash-attn + mm-prec default'],
      ['gr00t15',  'orinnano', 295.0, { rss: 4048 }, 1, 'defaults'],
      ['bitvla',   'orinnano', 335.5, { rss: 2193 }, 1, 'defaults'],
      ['pi0',      'orinnano', 688.7, { rss: 5901 }, 2, 'f16 weights + flash-attn'],
      ['evo1',     'orinnano', 722.7, { rss: 2133 }, 1, 'bf16 act + flash-attn'],
      ['pi05',     'orinnano', 765.8, { rss: 5925 }, 2, 'f16 weights + flash-attn'],

      // Apple M4 - apple-m4.md (BitVLA is CUDA only)
      ['octo',     'm4', 22.9, { rss: 838 }, 2, 'defaults'],
      ['turbovla', 'm4', 55.0, { rss: 747 }, 2, 'f16 weights + flash-attn'],
      ['jepa',     'm4', 249.0, { rss: 4043 }, 1, 'defaults'],
      ['adapter',  'm4', 316.3, { rss: 3712 }, 1, 'defaults'],
      ['smolvla',  'm4', 326.0, { rss: 1208 }, 2, 'f16 weights + flash-attn'],
      ['gr00t17',  'm4', 355.0, { rss: 5125 }, 1, 'defaults'],
      ['gr00t16',  'm4', 361.6, { rss: 4762 }, 1, 'defaults'],
      ['gr00t15',  'm4', 401.9, { rss: 3753 }, 1, 'defaults'],
      ['evo1',     'm4', 772.1, { rss: 1637 }, 1, 'f16 weights + flash-attn'],
      ['pi0',      'm4', 1149.7, { rss: 5549 }, 2, 'defaults'],
      ['pi05',     'm4', 1165.1, { rss: 5963 }, 2, 'defaults'],
      ['oft',      'm4', 1716.1, { rss: 15479 }, 1, 'defaults'],

      // Arc A380 - arc-a380.md (BitVLA is CUDA only; OpenVLA-OFT does not fit in 6 GB)
      ['octo',     'a380', 61.0, { vram: 585, rss: 497 }, 2, 'defaults'],
      ['turbovla', 'a380', 89.9, { vram: 541, rss: 561 }, 2, 'f16 weights'],
      ['jepa',     'a380', 356.8, { vram: 3855, rss: 468 }, 1, 'defaults'],
      ['adapter',  'a380', 410.0, { vram: 2750, rss: 1102 }, 1, 'defaults'],
      ['gr00t15',  'a380', 472.7, { vram: 3531, rss: 496 }, 1, 'defaults'],
      ['gr00t17',  'a380', 618.4, { vram: 4913, rss: 517 }, 1, 'defaults'],
      ['gr00t16',  'a380', 647.6, { vram: 4558, rss: 493 }, 1, 'defaults'],
      ['smolvla',  'a380', 736.5, { vram: 1159, rss: 508 }, 2, 'defaults'],
      ['pi0',      'a380', 924.2, { vram: 5366, rss: 513 }, 2, 'defaults'],
      ['pi05',     'a380', 948.1, { vram: 5659, rss: 513 }, 2, 'defaults'],
      ['evo1',     'a380', 1048.8, { vram: 1467, rss: 544 }, 1, 'defaults'],

      // Snapdragon X Hexagon NPU - snapdragon-x-hexagon.md (BitVLA is CUDA only; OpenVLA-OFT does not fit)
      ['octo',     'hexagon', 266.3, { rss: 679 }, 2, 'defaults'],
      ['turbovla', 'hexagon', 554.7, { rss: 586 }, 2, 'f16 weights + flash-attn'],
      ['jepa',     'hexagon', 846.2, { rss: 3900 }, 1, 'defaults'],
      ['smolvla',  'hexagon', 1246.9, { rss: 1129 }, 2, 'defaults'],
      ['gr00t17',  'hexagon', 1421.3, { rss: 4964 }, 1, 'defaults'],
      ['gr00t15',  'hexagon', 2773.9, { rss: 3560 }, 1, 'defaults'],
      ['gr00t16',  'hexagon', 2957.1, { rss: 4601 }, 1, 'defaults'],
      ['adapter',  'hexagon', 4099.2, { rss: 2796 }, 1, 'defaults'],
      ['pi0',      'hexagon', 5739.3, { rss: 5384 }, 2, 'defaults'],
      ['evo1',     'hexagon', 7292.2, { rss: 1499 }, 1, 'defaults'],
      ['pi05',     'hexagon', 9363.2, { rss: 5701 }, 2, 'defaults'],

      // Core i7-14700F - core-i7-14700f.md (BitVLA is CUDA only)
      ['octo',     'i7', 39.9, { rss: 622 }, 2, 'defaults'],
      ['turbovla', 'i7', 257.5, { rss: 854 }, 2, 'defaults'],
      ['jepa',     'i7', 1192.8, { rss: 3822 }, 1, 'defaults'],
      ['gr00t17',  'i7', 1455.2, { rss: 4882 }, 1, 'defaults'],
      ['smolvla',  'i7', 1548.7, { rss: 1049 }, 2, 'bf16 weights + flash-attn'],
      ['adapter',  'i7', 1585.4, { rss: 2707 }, 1, 'defaults'],
      ['gr00t16',  'i7', 1631.5, { rss: 4524 }, 1, 'defaults'],
      ['gr00t15',  'i7', 1915.1, { rss: 3499 }, 1, 'defaults'],
      ['evo1',     'i7', 3897, { rss: 1367 }, 1, 'flash-attn + mm-prec default'],
      ['pi05',     'i7', 6078, { rss: 5657 }, 2, 'defaults'],
      ['pi0',      'i7', 6465.7, { rss: 5355 }, 2, 'defaults'],
      ['oft',      'i7', 9881.1, { rss: 14797 }, 1, 'defaults'],

      // Core i9-14900HX - core-i9-14900hx.md (BitVLA is CUDA only)
      ['octo',     'i9', 71.8, { rss: 622 }, 2, 'defaults'],
      ['turbovla', 'i9', 325.9, { rss: 854 }, 2, 'defaults'],
      ['jepa',     'i9', 1273.3, { rss: 3822 }, 1, 'defaults'],
      ['gr00t17',  'i9', 1530.8, { rss: 4883 }, 1, 'defaults'],
      ['smolvla',  'i9', 1661.5, { rss: 1048 }, 2, 'flash-attn'],
      ['adapter',  'i9', 1689.6, { rss: 2706 }, 1, 'defaults'],
      ['gr00t16',  'i9', 1721.9, { rss: 4524 }, 1, 'defaults'],
      ['gr00t15',  'i9', 1966.1, { rss: 3499 }, 1, 'defaults'],
      ['evo1',     'i9', 3952.3, { rss: 1366 }, 1, 'flash-attn + mm-prec default'],
      ['pi05',     'i9', 5913.9, { rss: 5657 }, 2, 'defaults'],
      ['pi0',      'i9', 6342.8, { rss: 5353 }, 2, 'defaults'],
      ['oft',      'i9', 9636.7, { rss: 14796 }, 1, 'defaults'],

      // Core i5-12400F - core-i5-12400f.md (BitVLA is CUDA only; OpenVLA-OFT does not fit in 15 GiB)
      ['octo',     'i5', 78.9, { rss: 623 }, 2, 'defaults'],
      ['turbovla', 'i5', 361.0, { rss: 490 }, 2, 'f16 weights + flash-attn'],
      ['jepa',     'i5', 1674.6, { rss: 3823 }, 1, 'defaults'],
      ['gr00t17',  'i5', 1982.7, { rss: 4884 }, 1, 'defaults'],
      ['smolvla',  'i5', 2064.2, { rss: 1051 }, 2, 'f16 weights + flash-attn'],
      ['adapter',  'i5', 2179.3, { rss: 2707 }, 1, 'defaults'],
      ['gr00t16',  'i5', 2228.1, { rss: 4524 }, 1, 'defaults'],
      ['gr00t15',  'i5', 2692.9, { rss: 3500 }, 1, 'defaults'],
      ['evo1',     'i5', 5081.8, { rss: 1368 }, 1, 'flash-attn + mm-prec default'],
      ['pi05',     'i5', 8653.7, { rss: 5657 }, 2, 'defaults'],
      ['pi0',      'i5', 8979.1, { rss: 5356 }, 2, 'defaults'],

      // Ryzen 5 5500 - ryzen-5-5500.md (BitVLA is CUDA only; OpenVLA-OFT does not fit in 15 GiB)
      ['octo',     'ryzen5', 97.2, { rss: 622 }, 2, 'defaults'],
      ['turbovla', 'ryzen5', 453.2, { rss: 490 }, 2, 'f16 weights + flash-attn'],
      ['jepa',     'ryzen5', 2147.9, { rss: 3823 }, 1, 'defaults'],
      ['gr00t17',  'ryzen5', 2525.3, { rss: 4884 }, 1, 'defaults'],
      ['smolvla',  'ryzen5', 2687.5, { rss: 1050 }, 2, 'f16 weights + flash-attn'],
      ['adapter',  'ryzen5', 2804.8, { rss: 2707 }, 1, 'defaults'],
      ['gr00t16',  'ryzen5', 2833.3, { rss: 4524 }, 1, 'defaults'],
      ['gr00t15',  'ryzen5', 3461.6, { rss: 3500 }, 1, 'defaults'],
      ['evo1',     'ryzen5', 6813.3, { rss: 1368 }, 1, 'f16 weights + flash-attn'],
      ['pi05',     'ryzen5', 11333.6, { rss: 5656 }, 2, 'defaults'],
      ['pi0',      'ryzen5', 11439.9, { rss: 5355 }, 2, 'defaults'],

      // Snapdragon X Oryon CPU - snapdragon-x-hexagon.md (BitVLA is CUDA only; OpenVLA-OFT does not fit)
      ['octo',     'oryon', 111.6, { rss: 623 }, 2, 'defaults'],
      ['turbovla', 'oryon', 363.3, { rss: 485 }, 2, 'f16 weights'],
      ['jepa',     'oryon', 1668.1, { rss: 3826 }, 1, 'defaults'],
      ['gr00t17',  'oryon', 2018, { rss: 4886 }, 1, 'defaults'],
      ['adapter',  'oryon', 2181.2, { rss: 2708 }, 1, 'defaults'],
      ['smolvla',  'oryon', 2312.7, { rss: 1063 }, 2, 'defaults'],
      ['gr00t16',  'oryon', 2352.5, { rss: 4524 }, 1, 'defaults'],
      ['gr00t15',  'oryon', 2863.4, { rss: 3488 }, 1, 'defaults'],
      ['evo1',     'oryon', 5885.5, { rss: 1363 }, 1, 'defaults'],
      ['pi05',     'oryon', 10325.4, { rss: 5643 }, 2, 'defaults'],
      ['pi0',      'oryon', 10401.7, { rss: 5321 }, 2, 'defaults'],

      // Core Ultra X7 358H - core-ultra-x7-358h.md (Octo-Small has no OpenVINO path)
      // Arc B390 iGPU, OpenVINO GPU plugin
      ['turbovla', 'arcb390', 33.0, { shared: 1330, rss: 1216 }, 2, 'bf16 weights + flash-attn'],
      ['gr00t15',  'arcb390', 146.6, { shared: 10556, rss: 6726 }, 1, 'defaults'],
      ['jepa',     'arcb390', 154.5, { shared: 9387, rss: 5321 }, 1, 'defaults'],
      ['gr00t16',  'arcb390', 231.1, { shared: 14630, rss: 10159 }, 1, 'defaults'],
      ['gr00t17',  'arcb390', 232.2, { shared: 14931, rss: 11043 }, 1, 'defaults'],
      ['adapter',  'arcb390', 258.5, { shared: 7424, rss: 3747 }, 1, 'defaults'],
      ['smolvla',  'arcb390', 459.9, { shared: 2393, rss: 1851 }, 2, 'f16 weights + flash-attn'],
      ['pi05',     'arcb390', 586.4, { shared: 15754, rss: 11428 }, 2, 'defaults'],
      ['evo1',     'arcb390', 757.7, { shared: 4854, rss: 3039 }, 1, 'flash-attn + mm-prec default'],
      ['pi0',      'arcb390', 766.3, { shared: 25043, rss: 16969 }, 2, 'flash-attn + mm-prec default'],
      ['oft',      'arcb390', 1588.3, { shared: 41486, rss: 15266 }, 1, 'defaults'],
      // AI Boost NPU, OpenVINO NPU plugin. π0 (851.3 ms) is left out: docs/backend/ov.md
      // lists its NPU output as wrong, and the report did not re-check it.
      ['turbovla', 'aiboost', 63.6, { shared: 523, rss: 877 }, 2, 'f16 weights'],
      ['adapter',  'aiboost', 426.4, { shared: 2762, rss: 5038 }, 1, 'defaults'],
      ['oft',      'aiboost', 472.3, { shared: 14521, rss: 29642 }, 1, 'defaults'],
      ['smolvla',  'aiboost', 1678.9, { shared: 1486, rss: 2894 }, 2, 'defaults'],
      // ggml CPU backend (faster than the OpenVINO CPU plugin on every model)
      ['octo',     'x7cpu', 111.3, { rss: 623 }, 2, 'bf16 weights + flash-attn'],
      ['turbovla', 'x7cpu', 163.0, { rss: 855 }, 2, 'defaults'],
      ['jepa',     'x7cpu', 1041.8, { rss: 3824 }, 1, 'f16 weights'],
      ['gr00t17',  'x7cpu', 1238.8, { rss: 4884 }, 1, 'f16 weights + flash-attn'],
      ['adapter',  'x7cpu', 1380, { rss: 2707 }, 1, 'f16 weights'],
      ['gr00t16',  'x7cpu', 1384.6, { rss: 4524 }, 1, 'f16 weights + flash-attn'],
      ['smolvla',  'x7cpu', 1549.7, { rss: 1051 }, 2, 'f16 weights + flash-attn'],
      ['gr00t15',  'x7cpu', 1576.6, { rss: 3498 }, 1, 'f16 weights + flash-attn'],
      ['evo1',     'x7cpu', 3277, { rss: 1368 }, 1, 'f16 weights + flash-attn'],
      ['pi05',     'x7cpu', 4917.5, { rss: 5657 }, 2, 'f16 weights + flash-attn'],
      ['pi0',      'x7cpu', 4951.2, { rss: 5355 }, 2, 'f16 weights'],
      ['oft',      'x7cpu', 7947.1, { rss: 14797 }, 1, 'f16 weights + flash-attn'],

      // Apple M5 Max - docs/backend/metal.md, earlier build (BitVLA has no Metal path)
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
    ],
  },

  // CPU only. Every figure is an engine-only median for one complete action
  // chunk: preprocessing through un-normalized actions, no transport. INT8
  // (W8A8) changes the numerics and no accuracy is measured for it.
  'vla.simd': {
    models: {
      impact:   { name: 'IMPACT',                     image: '480×640', views: 2, chunk: 50 },
      act:      { name: 'ACT',                        image: '480×640', views: 2, chunk: 50 },
      octo:     { name: 'Octo-Small',                 image: '256 + 128', views: 2, chunk: 4 },
      turbovla: { name: 'TurboVLA',                   image: 256, views: 2, chunk: 12 },
      smolvla:  { name: 'SmolVLA',                    image: 512, views: 2, chunk: 50 },
      dp:       { name: 'Diffusion Policy (DDIM-10)', image: '480×640', views: '2 × 2 frames', chunk: 32 },
    },
    devices: {
      pi5:    { name: 'Raspberry Pi 5',        note: '4× Cortex-A76 @ 2.4 GHz, NEON (+sdot for INT8), active cooler; ran at its 85 °C soft limit, so better cooling would be faster. Median of 50 queries after 5 warmups (20 above 3 s). Memory: peak RSS.' },
      snapx:  { name: 'Snapdragon X',          note: '8 Oryon cores, NEON (+sdot for INT8), Windows 11 on AC power; sustained numbers, about 11% slower than a cold start. Median of 50 queries after 5 warmups (20 above 3 s). Memory: peak RSS.' },
      m4:     { name: 'Apple M4 (Mac mini)',   note: '4P + 6E cores, 24 GB, NEON (+sdot for INT8) and AMX through Accelerate. Median of 50 queries after 5 warmups. Memory: peak RSS.' },
      ryzen5: { name: 'AMD Ryzen 5 5500',      note: 'Zen 3, 6 cores / 12 threads, AVX2; no AVX-VNNI, so FP32 only. Median of 50 queries after 5 warmups. Memory: peak RSS.' },
      i5:     { name: 'Intel Core i5-12400F',  note: '6 P-cores / 12 threads, AVX2 (+AVX-VNNI for INT8). Median of 50 queries after 5 warmups. Memory: peak RSS.' },
      i7:     { name: 'Intel Core i7-14700F',  note: '8P + 12E cores, 28 threads, AVX2 (+AVX-VNNI for INT8). Median of 50 queries after 5 warmups. Memory: peak RSS.' },
      i9:     { name: 'Intel Core i9-14900HX', note: 'Laptop, 8P + 16E cores, AVX2 (+AVX-VNNI for INT8); power- and heat-limited under sustained load. Median of 50 queries after 5 warmups. Memory: peak RSS.' },
    },
    results: [
      ['impact', 'i9',     48.2, { rss: 765 }, null, 'int8 · 8 threads'],
      ['impact', 'i7',     52.6, { rss: 764 }, null, 'int8 · 8 threads'],
      ['impact', 'i5',     60.5, { rss: 765 }, null, 'int8 · 12 threads'],
      ['impact', 'm4',     70.5, { rss: 801 }, null, 'int8 · 10 threads'],
      ['impact', 'snapx',  77.8, { rss: 765 }, null, 'int8 · 8 threads'],
      ['impact', 'ryzen5', 170.8, { rss: 766 }, null, 'fp32 · 6 threads'],
      ['impact', 'pi5',    497.4, { rss: 767 }, null, 'int8 · 4 threads'],

      ['act', 'i9',     49.1, { rss: 556 }, null, 'int8 · 8 threads'],
      ['act', 'i7',     53.3, { rss: 482 }, null, 'int8 · 8 threads'],
      ['act', 'i5',     59.2, { rss: 483 }, null, 'int8 · 12 threads'],
      ['act', 'm4',     69.1, { rss: 661 }, null, 'int8 · 10 threads'],
      ['act', 'snapx',  74.7, { rss: 483 }, null, 'int8 · 8 threads'],
      ['act', 'ryzen5', 170.3, { rss: 590 }, null, 'fp32 · 6 threads'],
      ['act', 'pi5',    487.9, { rss: 485 }, null, 'int8 · 4 threads'],

      ['octo', 'i7',     29.8, { rss: 1078 }, null, 'int8 · 8 threads'],
      ['octo', 'i5',     35.0, { rss: 1078 }, null, 'int8 · 6 threads'],
      ['octo', 'snapx',  44.4, { rss: 1078 }, null, 'int8 · 8 threads'],
      ['octo', 'i9',     44.8, { rss: 1078 }, null, 'int8 · 4 threads'],
      ['octo', 'm4',     47.9, { rss: 1103 }, null, 'fp32 · 4 threads'],
      ['octo', 'ryzen5', 73.0, { rss: 1078 }, null, 'fp32 · 6 threads'],
      ['octo', 'pi5',    354.3, { rss: 1080 }, null, 'int8 · 4 threads'],

      ['turbovla', 'm4',     114.5, { rss: 2606 }, null, 'fp32 · 10 threads'],
      ['turbovla', 'i9',     116.0, { rss: 1771 }, null, 'fp32 · 32 threads'],
      ['turbovla', 'i7',     132.7, { rss: 1771 }, null, 'fp32 · 28 threads'],
      ['turbovla', 'i5',     155.4, { rss: 1771 }, null, 'fp32 · 12 threads'],
      ['turbovla', 'ryzen5', 187.6, { rss: 1771 }, null, 'fp32 · 6 threads'],
      ['turbovla', 'snapx',  217.0, { rss: 1770 }, null, 'fp32 · 8 threads'],
      ['turbovla', 'pi5',    1590, { rss: 1773 }, null, 'fp32 · 4 threads'],

      ['smolvla', 'i9',     401.7, { rss: 2249 }, null, 'int8 · 8 threads'],
      ['smolvla', 'i7',     402.6, { rss: 2249 }, null, 'int8 · 8 threads'],
      ['smolvla', 'i5',     462.6, { rss: 2250 }, null, 'int8 · 12 threads'],
      ['smolvla', 'm4',     494.4, { rss: 3027 }, null, 'int8 · 10 threads'],
      ['smolvla', 'snapx',  660.4, { rss: 1957 }, null, 'int8 · 8 threads'],
      ['smolvla', 'ryzen5', 1162, { rss: 2250 }, null, 'fp32 · 6 threads'],
      ['smolvla', 'pi5',    3961, { rss: 1959 }, null, 'int8 · 4 threads'],

      ['dp', 'i9',     127.6, { rss: 2152 }, null, 'int8 · 8 threads'],
      ['dp', 'i7',     165.7, { rss: 2152 }, null, 'int8 · 8 threads'],
      ['dp', 'snapx',  169.6, { rss: 2152 }, null, 'int8 · 8 threads'],
      ['dp', 'i5',     178.1, { rss: 2152 }, null, 'int8 · 12 threads'],
      ['dp', 'm4',     180.2, { rss: 2380 }, null, 'int8 · 10 threads'],
      ['dp', 'ryzen5', 738.0, { rss: 2166 }, null, 'fp32 · 6 threads'],
      ['dp', 'pi5',    1078, { rss: 2154 }, null, 'int8 · 4 threads'],
    ],
  },
};
