import json
import shutil
from pathlib import Path
from tqdm import tqdm

STORAGE_PATH = Path.home() / "storage"
FOLDER_NAME = "dummy_data"

EXPECTED_IMAGE_FOLDER_NAME = "images"
EXPECTED_METADATA_FOLDER_NAME = "metadata"

def main():
    # loop all json files in the folder even subfolders
    folder_path = STORAGE_PATH / FOLDER_NAME
    image_dir = folder_path / EXPECTED_IMAGE_FOLDER_NAME
    metadata_dir = folder_path / EXPECTED_METADATA_FOLDER_NAME

    errors = []

    image_dir.mkdir(parents=True, exist_ok=True)
    metadata_dir.mkdir(parents=True, exist_ok=True)
    
    # loop all json files in the folder even subfolders
    all_json_files = []
    for file in folder_path.glob("**/*.json"):
        if file.is_file():
            all_json_files.append(file)
        
    for file in tqdm(all_json_files):
        
        # src image path is the file replaced from `.json` to `.jpg`
        image_file_name = file.stem + ".jpg"
        src_image_path = file.parent / image_file_name

        image_parrent_dir =  image_dir / file.parent.name
        image_parrent_dir.mkdir(parents=True, exist_ok=True)

        metadata_parrent_dir =  metadata_dir / file.parent.name
        metadata_parrent_dir.mkdir(parents=True, exist_ok=True)

        dst_image_path = image_parrent_dir / image_file_name
        dst_metadata_path = metadata_parrent_dir / file.name
        
        # move the image to the image_dir
        try:
            shutil.move(file, dst_metadata_path)
            shutil.move(src_image_path, dst_image_path)
            # print(file, dst_metadata_path, dst_image_path)
        except FileNotFoundError:
            errors.append(f"File not found: {src_image_path}")
            continue

    with open("error.txt", "w") as f:
        for error in errors:
            f.write(error + "\n")


if __name__ == "__main__":
    main()