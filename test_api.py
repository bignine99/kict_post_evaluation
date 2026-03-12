import urllib.request
import json
try:
    with urllib.request.urlopen('http://localhost:8000/api/v1/dashboard/rag-stats') as response:
        html = response.read()
        print(json.loads(html))
except Exception as e:
    print(e)
