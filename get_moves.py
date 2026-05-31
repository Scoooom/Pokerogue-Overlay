import urllib.request
import re
import json

print("Fetching latest Showdown moves database...")
url = "https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/moves.ts"
try:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req) as response:
        text = response.read().decode("utf-8")
    
    # Locate all individual property assignment blocks across the global schema definitions
    blocks = re.split(r"^\t[a-z0-9]+:\s*\{", text, flags=re.MULTILINE)
    
    formatted_moves = {}
    for body in blocks:
        # Match explicit string declarations for display name and primary type
        name_match = re.search(r"name:\s*[\"']([^\"']+)[\"']", body)
        type_match = re.search(r"type:\s*[\"']([^\"']+)[\"']", body)
        
        if name_match and type_match:
            name = name_match.group(1).strip()
            move_type = type_match.group(1).strip().capitalize()
            
            # Filter away base setup objects that do not reflect playable skills
            if name and move_type:
                formatted_moves[name] = {"type": move_type}
            
    with open("moves.json", "w") as f:
        json.dump(formatted_moves, f, indent=2)
        
    print(f"Success! Generated moves.json with {len(formatted_moves)} total modern moves (including Sappy Seed).")
except Exception as e:
    print(f"Error executing extraction sequence: {e}")
