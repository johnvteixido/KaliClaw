import ast
import sys
import json

# --- Allowed for Kali Linux ---
# os, subprocess, sys are ALLOWED so agents can use native Kali tools
DANGEROUS_MODULES = set([
    "shutil", "ctypes"
])

DANGEROUS_CALLS = set([
    "eval", "exec", "__import__", "compile", 
    "globals", "locals", "vars", "dir"
])

DANGEROUS_ATTR_CHAINS = set([
    "os.remove", "os.unlink", "os.rmdir", "os.removedirs",
    "os.rename", "os.renames", "os.replace",
    "shutil.rmtree", "shutil.move", "shutil.copy", "shutil.copy2",
    "ctypes.cdll", "ctypes.windll",
])

PROTECTED_PATH_PREFIXES = [
    "/etc",
    "/boot",
    "/bin",
    "/sbin",
    "/usr",
    "/var/lib",
    "/root",
    "~/.openclaw",
    "~/.gemini",
]

class ASTFirewallVisitor(ast.NodeVisitor):
    def __init__(self):
        self.violations = []

    def visit_Import(self, node):
        for alias in node.names:
            root_module = alias.name.split(".")[0]
            if root_module in DANGEROUS_MODULES:
                self.violations.append({"line": node.lineno, "col": node.col_offset, "type": "dangerous_import", "detail": f"import {alias.name}"})
        self.generic_visit(node)

    def visit_ImportFrom(self, node):
        if node.module:
            root_module = node.module.split(".")[0]
            if root_module in DANGEROUS_MODULES:
                self.violations.append({"line": node.lineno, "col": node.col_offset, "type": "dangerous_import", "detail": f"from {node.module} import ..."})
        self.generic_visit(node)

    def visit_Call(self, node):
        func_name = self._resolve_call_name(node.func)
        if func_name in DANGEROUS_CALLS:
            self.violations.append({"line": node.lineno, "col": node.col_offset, "type": "dangerous_call", "detail": f"{func_name}()"})
        if func_name in DANGEROUS_ATTR_CHAINS:
            self.violations.append({"line": node.lineno, "col": node.col_offset, "type": "dangerous_attr_call", "detail": f"{func_name}()"})
        
        if func_name == "open" and len(node.args) >= 1:
            path_arg = node.args[0]
            if isinstance(path_arg, ast.Constant) and isinstance(path_arg.value, str):
                resolved = path_arg.value
                for prefix in PROTECTED_PATH_PREFIXES:
                    if resolved.startswith(prefix):
                        mode = "r"
                        if len(node.args) >= 2 and isinstance(node.args[1], ast.Constant):
                            mode = str(node.args[1].value)
                        if any(c in mode for c in ("w", "a", "x", "+")):
                            self.violations.append({"line": node.lineno, "col": node.col_offset, "type": "protected_path_write", "detail": f'open("{path_arg.value}", "{mode}") targets protected path'})
        self.generic_visit(node)

    def _resolve_call_name(self, node):
        if isinstance(node, ast.Name): return node.id
        if isinstance(node, ast.Attribute):
            parent = self._resolve_call_name(node.value)
            return f"{parent}.{node.attr}" if parent else node.attr
        return None

def analyze_file(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        source = f.read()
    try:
        tree = ast.parse(source, filename=filepath)
    except SyntaxError as e:
        return {"status": "parse_error", "error": f"SyntaxError at line {e.lineno}: {e.msg}"}
    visitor = ASTFirewallVisitor()
    visitor.visit(tree)
    if visitor.violations:
        return {"status": "blocked", "violations": visitor.violations, "summary": f"Blocked {len(visitor.violations)} violation(s)"}
    return {"status": "safe"}

if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(2)
    result = analyze_file(sys.argv[1])
    print(json.dumps(result))
    sys.exit(0 if result["status"] == "safe" else 1)
