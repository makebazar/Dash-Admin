#!/bin/bash
# Generate Mosquitto password file for Windows

PWFILE="${MQTT_PASSWORD_FILE:-./mosquitto/config/pwfile}"
USER="${MQTT_USERNAME:-dashadmin}"
PASS="${MQTT_PASSWORD:-changeme_strong_password_here}"

# Using Docker to generate password file (works on Windows with Docker Desktop)
docker run --rm -v "$(pwd):/mosquitto/config" ^
    eclipse-mosquitto:latest mosquitto_passwd -c -b /mosquitto/config/pwfile "%USER%" "%PASS%"

echo Password file generated.
