from app import app

# Vercel serverless WSGI entry point
# Exports the Flask WSGI callable
# When deployed to Vercel, @vercel/python wraps 'app' automatically.
