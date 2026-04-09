#!/bin/bash
# Script del servidor — usa setup-domain-mac.sh en su lugar.
# Este archivo se mantiene por compatibilidad.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "$SCRIPT_DIR/setup-domain-mac.sh" "$@"
