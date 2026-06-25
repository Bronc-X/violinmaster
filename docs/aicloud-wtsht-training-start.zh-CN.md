# ViolinMaster 在 AIcloud.WTSHT.CN 上的训练启动指南

日期：2026-06-19

## 当前结论

`violinmaster` 已经克隆到本地：

```bash
D:\Toni\code\violinmaster
```

远端仓库是：

```bash
git@github.com:Bronc-X/violinmaster.git
```

当前代码是一个浏览器端小提琴练习工作台 MVP，不是已经包含训练脚本的机器学习仓库。它现在有：

- 浏览器录音和音频上传工作流。
- 基于合成/上传音频的音准、节奏分析逻辑。
- 曲目、MusicXML 摘要、练习门禁和教练面板。
- Node.js 测试和静态构建基线。

它现在还没有：

- Python 训练入口。
- PyTorch / TensorFlow 依赖。
- 数据集目录规范。
- checkpoint 输出规范。
- 适合直接提交到云 GPU 的训练命令。

所以这次上 AIcloud.WTSHT.CN 的第一阶段目标不是“立刻训练一个大模型”，而是先跑通云端 Notebook、GPU、存储、仓库依赖和第一版古典音乐数据处理基线。等基线跑通后，再决定训练 pitch/rhythm 诊断模型、AI 教练文本模型，还是更复杂的音频-乐谱对齐模型。

## 参考得物生图项目的迁移方式

得物生图项目里的云算力路线可以复用为 ViolinMaster 的训练流程骨架：

| 得物生图里的做法 | ViolinMaster 对应做法 |
|---|---|
| 用 JupyterLab / Notebook 做算法开发和实验调试 | 用 Notebook 验证 GPU、音频库、MusicXML/MIDI 处理和 baseline 脚本 |
| 使用云端 GPU 主机、容器、存储挂载 | 使用云 GPU 跑音频特征提取、模型训练和批量评估 |
| 数据上传到 PVC 或并行文件存储 | 上传授权乐谱、MIDI、参考演奏、学生练习音频和标注 |
| 分布式训练任务跑 PyTorch 命令 | 后续把 notebook 中稳定的脚本固化成训练任务 |
| TensorBoard 看 loss / 指标 | 看 pitch error、rhythm F1、alignment accuracy、coach label accuracy |
| 模型仓库管理 checkpoint | 保存 `checkpoints/violinmaster/<experiment_id>/` 并记录配置 |

核心原则保持一致：Notebook 先验证，训练任务再固化，模型输出必须能用固定测试集验收。

## 平台操作路径

AIcloud.WTSHT.CN 当前会跳转到 Hypersuite 平台。因为平台后台需要你的账号登录，以下是登录后的操作路径，不假装已经进入你的租户后台。

1. 登录 `https://aicloud.wtsht.cn/`。
2. 进入算力或开发环境模块，选择 `Notebook` / `JupyterLab`。
3. 新建 Notebook 实例。
4. 镜像优先选择 PyTorch 镜像；如果只有通用 Python 镜像，也可以先创建，再在 Notebook 里安装依赖。
5. 资源规格优先选择单卡 GPU。第一轮验证不需要多机多卡。
6. 挂载持久化存储，建议挂到：

```text
/workspace
```

7. 在 JupyterLab 终端里进入工作目录：

```bash
cd /workspace
```

8. 克隆仓库：

```bash
git clone https://github.com/Bronc-X/violinmaster.git
cd violinmaster
```

如果平台支持 SSH key，也可以用：

```bash
git clone git@github.com:Bronc-X/violinmaster.git
cd violinmaster
```

9. 先跑项目基线：

```bash
node --version
npm install
npm run test:baseline
```

10. 再跑 Python / GPU 环境验证：

```bash
python -V
python - <<'PY'
try:
    import torch
    print("torch", torch.__version__)
    print("cuda_available", torch.cuda.is_available())
    print("device_count", torch.cuda.device_count())
    if torch.cuda.is_available():
        print("device_name", torch.cuda.get_device_name(0))
except Exception as exc:
    print("torch_check_failed", repr(exc))
PY
```

## 云端目录建议

在 `/workspace/violinmaster` 下创建这些目录。先不要把大数据集提交进 Git。

```text
data/
  raw/
    audio/
    midi/
    musicxml/
    reference_audio/
  interim/
    features/
    alignments/
  processed/
    manifests/
    splits/
experiments/
  runs/
checkpoints/
  violinmaster/
reports/
  tensorboard/
  eval/
```

建议把这些目录加入云端持久存储，但 Git 里只提交小的说明、manifest schema 和脚本，不提交真实授权音频。

## 第一轮数据格式

第一轮不要从复杂大模型开始。先把每条样本整理成 `jsonl` manifest。

```json
{"id":"bach-minuet-001-ref","piece_id":"bach-minuet-g","split":"train","audio_path":"data/raw/audio/bach-minuet-001.wav","musicxml_path":"data/raw/musicxml/bach-minuet-g.musicxml","midi_path":"data/raw/midi/bach-minuet-g.mid","performer_type":"reference","rights_status":"licensed","labels":{"pitch_quality":"stable","rhythm_quality":"stable"}}
```

最少字段：

- `id`：样本唯一 ID。
- `piece_id`：曲目 ID，要能和产品里的曲目数据对应。
- `split`：`train` / `val` / `test`。
- `audio_path`：音频文件路径。
- `musicxml_path` 或 `midi_path`：至少有一个乐谱参考。
- `performer_type`：`reference` / `student` / `teacher`。
- `rights_status`：`public-domain` / `licensed` / `teacher-provided` / `private-dataset`。
- `labels`：第一轮可以是人工粗标签，后续再细化到小节级。

## 第一阶段训练目标

建议按这个顺序做，不要一上来训练“古典音乐大模型”。

### P0：云端可运行基线

目标：证明平台能跑 ViolinMaster 的代码、数据处理和 GPU 检查。

验收标准：

- `npm run test:baseline` 通过。
- Jupyter 能打开仓库。
- Python 能读写 `/workspace`。
- `torch.cuda.is_available()` 返回 `true`，或明确记录平台当前镜像为什么没有 GPU 版 PyTorch。
- 能读取 1 条音频和 1 条 MusicXML/MIDI。

### P1：音频特征 baseline

目标：先不训练深度模型，生成可复现的音频特征。

建议特征：

- pitch contour。
- onset envelope。
- tempo estimate。
- RMS / silence / clipping quality gate。
- pitch deviation against MIDI/MusicXML note timeline。

验收标准：

- 同一条音频重复运行输出一致。
- 低质量音频能被标记为 `insufficient-audio`。
- 至少 10 条样本可以生成 `features/*.json` 或 `features/*.parquet`。

### P2：小节级诊断模型

目标：训练轻量模型判断小节级音准/节奏问题。

可选模型：

- scikit-learn / XGBoost：用手工特征做第一版分类器。
- PyTorch MLP：输入音频特征，输出 `pitch-high` / `pitch-low` / `rhythm-drag` / `stable`。
- 后续再考虑 CRNN / Transformer 做序列建模。

验收标准：

- 固定 `test` split。
- 输出 per-class precision / recall / F1。
- 不能只看 loss，必须看小节级诊断是否对练习闭环有用。

### P3：AI 教练文本层

目标：把确定性诊断结果转成老师式中文反馈。

第一版可以先用 prompt + 结构化输出，不需要训练模型。只有当我们积累足够的老师反馈样本后，再考虑 SFT 或偏好优化。

验收标准：

- 不泄漏原始工程指标给学生。
- 反馈必须包含具体小节、问题、重练动作。
- 同一诊断输入输出稳定，不胡编不存在的问题。

## Jupyter 启动脚本

可以把下面这段放到 Notebook 的第一格：

```bash
!pwd
!git remote -v
!git status --short --branch
!node --version || true
!npm --version || true
!python -V
```

第二格跑 GPU：

```python
try:
    import torch
    print("torch:", torch.__version__)
    print("cuda:", torch.cuda.is_available())
    print("gpu_count:", torch.cuda.device_count())
    if torch.cuda.is_available():
        print("gpu:", torch.cuda.get_device_name(0))
except Exception as exc:
    print("Torch check failed:", repr(exc))
```

第三格跑仓库基线：

```bash
!npm install
!npm run test:baseline
```

## 训练前必须向平台确认

1. 当前 Notebook 镜像是否内置 GPU 版 PyTorch。
2. GPU 型号、显存、CUDA 或国产兼容层版本。
3. Notebook 存储是否持久化，实例关闭后 `/workspace` 是否保留。
4. 是否支持从 GitHub 拉取私有仓库或 SSH key。
5. 是否支持 TensorBoard，并如何映射日志目录。
6. 自定义训练任务是否能挂载同一个 Notebook 存储。
7. checkpoint 是否可以上传到模型仓库。
8. 大量小音频文件读取性能如何，是否建议打包成 shard。
9. 是否有对象存储或数据集管理功能。
10. 账单能否按项目和实验导出。

## 不要做的事

- 不要把真实学生录音、老师授权录音或版权乐谱提交到 Git。
- 不要在没有固定测试集时宣称模型变好了。
- 不要只根据训练 loss 判断产品可用。
- 不要让 AI 教练直接凭空评价演奏，必须先有结构化诊断事实。
- 不要一开始就多机多卡。单卡跑通数据和指标更重要。

## 下一步

1. 在 AIcloud.WTSHT.CN 新建 JupyterLab 实例。
2. 克隆 `Bronc-X/violinmaster`。
3. 跑 `npm run test:baseline`。
4. 跑 GPU 检查。
5. 上传 5 到 10 条授权音频和对应 MusicXML/MIDI。
6. 建立 `data/processed/manifests/seed.jsonl`。
7. 决定第一版 baseline 是规则特征、轻量分类器，还是 AI 教练文本层。
