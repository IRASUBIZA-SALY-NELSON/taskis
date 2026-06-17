import os

directory = '/home/minister/Documents/taskis/frontend/src'

for root, _, files in os.walk(directory):
    for file in files:
        if file.endswith(('.tsx', '.ts')):
            path = os.path.join(root, file)
            with open(path, 'r') as f:
                content = f.read()
            
            new_content = content.replace("'http://localhost:8080", "`http://${window.location.hostname}:8080")
            new_content = new_content.replace('`http://localhost:8080', '`http://${window.location.hostname}:8080')
            new_content = new_content.replace('"http://localhost:8080', '`http://${window.location.hostname}:8080')
            
            # Since we changed 'http... to `http..., we also need to change the closing quote if it was a string literal
            # Wait, `replace("'http://localhost:8080/api/chat/users'")` becomes `` `http://${window.location.hostname}:8080/api/chat/users'` ``
            # That's invalid! We need regex.

import re
for root, _, files in os.walk(directory):
    for file in files:
        if file.endswith(('.tsx', '.ts')):
            path = os.path.join(root, file)
            with open(path, 'r') as f:
                content = f.read()
            
            # Replace single quoted strings
            content = re.sub(r"'http://localhost:8080([^']*)'", r"`http://${window.location.hostname}:8080\1`", content)
            # Replace double quoted strings
            content = re.sub(r'"http://localhost:8080([^"]*)"', r"`http://${window.location.hostname}:8080\1`", content)
            # Replace backticked strings
            content = content.replace("http://localhost:8080", "http://${window.location.hostname}:8080")

            with open(path, 'w') as f:
                f.write(content)
print("Done")
