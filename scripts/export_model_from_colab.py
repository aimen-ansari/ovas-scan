"""Run this cell/script in the original Colab session to download the saved weights."""
from pathlib import Path
from google.colab import drive, files
path = Path('/content/drive/MyDrive/Ovarian_Research_Project/models/efficientnet_b3_best.pth')
if not path.exists():
    drive.mount('/content/drive')
if not path.is_file():
    raise FileNotFoundError(f'The trained checkpoint is missing: {path}. Finish the EfficientNet-B3 training cells first.')
files.download(str(path))
