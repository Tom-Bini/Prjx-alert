import requests

url = "https://api.prjx.com/auth/me"
headers = {
    "Authorization": "Bearer TON_JWT_ICI",
    "Accept": "*/*",
    "Content-Type": "application/json"
}

response = requests.get(url, headers=headers)

if response.status_code == 200:
    print(response.json())
else:
    print(f"Erreur {response.status_code}: {response.text}")
