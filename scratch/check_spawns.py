import os

paths = [
    r'C:\Users\jfan\AppData\Roaming\npm\node_modules',
    r'C:\Users\jfan\AppData\Roaming\nvm\v22.22.2\node_modules',
]

for p in paths:
    if os.path.exists(p):
        print(f"Path: {p}")
        for item in os.listdir(p):
            if 'opencode' in item.lower():
                print(f"  {item}")
