FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for database drivers
RUN apt-get update && apt-get install -y libpq-dev gcc && rm -rf /var/lib/apt/lists/*

# Copy and install the python libraries
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy your script into the container
COPY . . 

# Run the hyphenated filename
CMD ["python", "-u", "gmail-agent.py"]