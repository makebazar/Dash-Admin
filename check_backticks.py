import os


def check_backticks():
    for root, _, files in os.walk("."):
        if any(d in root for d in [".git", "node_modules", ".next"]):
            continue
        for file in files:
            path = os.path.join(root, file)
            try:
                with open(path, "r", encoding="utf-8") as f:
                    content = f.read()
                    if "`" in content:
                        count = content.count("`")
                        if count % 2 != 0:
                            print(f"Unbalanced backticks in {path}: {count}")
            except Exception:
                continue


if __name__ == "__main__":
    check_backticks()
