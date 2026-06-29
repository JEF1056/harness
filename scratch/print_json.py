import json

path = '/home/jfan/.cache/opencode/packages/github:JEF1056/harness/200e4c5373db807b2e8d4b7a2d6fb098fad675a7/node_modules/@williamcr01/opencode-tps/package.json'
try:
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    print(json.dumps(data, indent=2))
except Exception as e:
    print(f"Error: {e}")
