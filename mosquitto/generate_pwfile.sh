#!/bin/bash
# Generate Mosquitto password file
# Usage: ./generate_pwfile.sh

PWFILE="${MQTT_PASSWORD_FILE:-./config/pwfile}"
USER="${MQTT_USERNAME:-dashadmin}"
PASS="${MQTT_PASSWORD:-changeme_strong_password_here}"

docker run --rm -v "$(pwd)/mosquitto/config:/mosquitto/config" \
    eclipse-mosquitto:latest mosquitto_passwd -c -b /mosquitto/config/pwfile "$USER" "$PASS"

echo "Password file generated at mosquitto/config/pwfile"
