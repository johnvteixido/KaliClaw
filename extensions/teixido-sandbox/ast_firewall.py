"""
Teixido AST Firewall — Real Python AST analysis.

Parses code with ast.parse(), walks the full syntax tree, and detects
dangerous node patterns that regex can never catch (string concatenation
tricks, getattr() calls, exec/eval with obfuscated arguments, etc.).

Exit codes:
  0  = safe
  1  = blocked (prints JSON with reason)
  2  = parse error (prints JSON with error)

Usage:
  python ast_firewall.py <filepath>
"""
import ast
import json
import sys
import os

# --- Dangerous built-in function names ---
DANGEROUS_CALLS = frozenset({
    "exec", "eval", "compile", "__import__",
    "breakpoint", "exit", "quit",
})

# --- Dangerous module names ---
DANGEROUS_MODULES = frozenset({
    "os", "shutil", "subprocess", "ctypes",
    "signal", "pty", "commands", "pdb",
    "code", "codeop", "compileall",
    "importlib", "runpy", "multiprocessing",
})

# --- Dangerous attribute access patterns (module.function) ---
DANGEROUS_ATTR_CHAINS = frozenset({
    "os.system", "os.popen", "os.exec", "os.execl", "os.execle",
    "os.execlp", "os.execlpe", "os.execv", "os.execve", "os.execvp",
    "os.execvpe", "os.spawn", "os.spawnl", "os.spawnle", "os.spawnlp",
    "os.remove", "os.unlink", "os.rmdir", "os.removedirs",
    "os.rename", "os.renames", "os.replace",
    "os.kill", "os.killpg",
    "shutil.rmtree", "shutil.move", "shutil.copy", "shutil.copy2",
    "subprocess.run", "subprocess.call", "subprocess.Popen",
    "subprocess.check_call", "subprocess.check_output",
    "subprocess.getoutput", "subprocess.getstatusoutput",
    "ctypes.cdll", "ctypes.windll",
})

# --- Paths that must never be written to (outside sandbox) ---
PROTECTED_PATH_PREFIXES = [
    "C:\\Windows",
    "C:\\Program Files",
    "<USER_HOME>\\AppData",
    "<USER_HOME>\\Documents",
    "<USER_HOME>\\Desktop",
    "<USER_HOME>\\OneDrive",
    "<USER_HOME>\\.openclaw",
    "<USER_HOME>\\.gemini",
]


class ASTFirewallVisitor(ast.NodeVisitor):
    """Walks the full AST and collects every violation."""

    def __init__(self):
        self.violations = []

    # --- Import statements ---
    def visit_Import(self, node):
        for alias in node.names:
            root_module = alias.name.split(".")[0]
            if root_module in DANGEROUS_MODULES:
                self.violations.append({
                    "line": node.lineno,
                    "col": node.col_offset,
                    "type": "dangerous_import",
                    "detail": f"import {alias.name}",
                })
        self.generic_visit(node)

    def visit_ImportFrom(self, node):
        if node.module:
            root_module = node.module.split(".")[0]
            if root_module in DANGEROUS_MODULES:
                self.violations.append({
                    "line": node.lineno,
                    "col": node.col_offset,
                    "type": "dangerous_import",
                    "detail": f"from {node.module} import ...",
                })
        self.generic_visit(node)

    # --- Dangerous function calls (exec, eval, __import__, etc.) ---
    def visit_Call(self, node):
        func_name = self._resolve_call_name(node.func)

        # Direct calls: exec(...), eval(...), __import__(...)
        if func_name in DANGEROUS_CALLS:
            self.violations.append({
                "line": node.lineno,
                "col": node.col_offset,
                "type": "dangerous_call",
                "detail": f"{func_name}()",
            })

        # Attribute calls: os.system(...), subprocess.Popen(...)
        if func_name in DANGEROUS_ATTR_CHAINS:
            self.violations.append({
                "line": node.lineno,
                "col": node.col_offset,
                "type": "dangerous_attr_call",
                "detail": f"{func_name}()",
            })

        # getattr() used to dynamically resolve dangerous attributes
        if func_name == "getattr" and len(node.args) >= 2:
            if isinstance(node.args[1], ast.Constant) and isinstance(node.args[1].value, str):
                attr_val = node.args[1].value
                if attr_val in ("system", "popen", "remove", "rmtree", "exec", "eval"):
                    self.violations.append({
                        "line": node.lineno,
                        "col": node.col_offset,
                        "type": "dynamic_getattr_exploit",
                        "detail": f'getattr(?, "{attr_val}")',
                    })

        # open() calls targeting protected paths
        if func_name == "open" and len(node.args) >= 1:
            path_arg = node.args[0]
            if isinstance(path_arg, ast.Constant) and isinstance(path_arg.value, str):
                resolved = path_arg.value.replace("/", "\\")
                for prefix in PROTECTED_PATH_PREFIXES:
                    if resolved.upper().startswith(prefix.upper()):
                        # Check if mode is write
                        mode = "r"
                        if len(node.args) >= 2 and isinstance(node.args[1], ast.Constant):
                            mode = str(node.args[1].value)
                        for kw in node.keywords:
                            if kw.arg == "mode" and isinstance(kw.value, ast.Constant):
                                mode = str(kw.value.value)
                        if any(c in mode for c in ("w", "a", "x", "+")):
                            self.violations.append({
                                "line": node.lineno,
                                "col": node.col_offset,
                                "type": "protected_path_write",
                                "detail": f'open("{path_arg.value}", "{mode}") targets protected path',
                            })

        self.generic_visit(node)

    # --- String concatenation tricks to build module names ---
    def visit_BinOp(self, node):
        # Detect 'o'+'s' style concatenation used to evade string matching
        if isinstance(node.op, ast.Add):
            reconstructed = self._try_reconstruct_string(node)
            if reconstructed and reconstructed in DANGEROUS_MODULES:
                self.violations.append({
                    "line": node.lineno,
                    "col": node.col_offset,
                    "type": "obfuscated_module_name",
                    "detail": f'String concatenation builds "{reconstructed}"',
                })
        self.generic_visit(node)

    # --- chr() concatenation: exec(chr(105)+chr(109)+...) ---
    def visit_JoinedStr(self, node):
        # f-string based obfuscation
        self.generic_visit(node)

    # --- Helpers ---
    def _resolve_call_name(self, node):
        """Resolve a Call node's function to a dotted string name."""
        if isinstance(node, ast.Name):
            return node.id
        if isinstance(node, ast.Attribute):
            parent = self._resolve_call_name(node.value)
            if parent:
                return f"{parent}.{node.attr}"
            return node.attr
        # __builtins__.__dict__[...] pattern
        if isinstance(node, ast.Subscript):
            parent = self._resolve_call_name(node.value)
            if parent and "builtins" in parent:
                if isinstance(node.slice, ast.Constant) and isinstance(node.slice.value, str):
                    return node.slice.value
        return None

    def _try_reconstruct_string(self, node):
        """Try to statically evaluate a BinOp(Add) of string constants."""
        if isinstance(node, ast.Constant) and isinstance(node.value, str):
            return node.value
        if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Add):
            left = self._try_reconstruct_string(node.left)
            right = self._try_reconstruct_string(node.right)
            if left is not None and right is not None:
                return left + right
        return None


def analyze_file(filepath):
    """Parse a Python file and run the AST firewall."""
    with open(filepath, "r", encoding="utf-8") as f:
        source = f.read()

    try:
        tree = ast.parse(source, filename=filepath)
    except SyntaxError as e:
        return {
            "status": "parse_error",
            "error": f"SyntaxError at line {e.lineno}: {e.msg}",
        }

    visitor = ASTFirewallVisitor()
    visitor.visit(tree)

    if visitor.violations:
        return {
            "status": "blocked",
            "violations": visitor.violations,
            "summary": f"Blocked {len(visitor.violations)} violation(s)",
        }

    return {"status": "safe"}


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(json.dumps({"status": "error", "error": "Usage: python ast_firewall.py <filepath>"}))
        sys.exit(2)

    result = analyze_file(sys.argv[1])
    print(json.dumps(result))

    if result["status"] == "safe":
        sys.exit(0)
    elif result["status"] == "blocked":
        sys.exit(1)
    else:
        sys.exit(2)
