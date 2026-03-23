#!/usr/bin/env python3
"""
Workaround runner for Python 3.14 httpcore/httpx typing compatibility
"""
import sys
import os

# Python 3.14 compatibility fix for httpcore/httpx typing issue
if sys.version_info >= (3, 14):
    import typing
    try:
        # Patch Union to work with httpcore's __module__ assignment
        if not hasattr(typing.Union, '__module__'):
            object.__setattr__(typing.Union, '__module__', 'typing')
    except (TypeError, AttributeError):
        pass
    
    # Also patch the typing module's __setattr__ to be more lenient
    import types
    original_setattr = setattr
    def patched_setattr(obj, name, value):
        try:
            return original_setattr(obj, name, value)
        except (TypeError, AttributeError) as e:
            if 'typing' in str(obj) or 'Union' in str(obj):
                try:
                    object.__setattr__(obj, name, value)
                except:
                    pass
            else:
                raise
    
    # Replace setattr in builtins
    import builtins
    builtins.setattr = patched_setattr

# Now run uvicorn
import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
