#!/bin/bash

# Directorio fuente (por defecto ./src)
SOURCE_DIR=${1:-"./src"}

# Archivo de salida (por defecto all-sources.txt)
OUTPUT_FILE=${2:-"all-sources.txt"}

# Verificar que el directorio existe
if [ ! -d "$SOURCE_DIR" ]; then
    echo "❌ El directorio $SOURCE_DIR no existe"
    exit 1
fi

echo "🔍 Buscando archivos .ts en: $SOURCE_DIR"

# Limpiar archivo de salida
> "$OUTPUT_FILE"

# Contador de archivos
count=0

# Buscar todos los archivos .ts y procesarlos
find "$SOURCE_DIR" -name "*.ts" -type f | sort | while read -r file; do
    # Obtener ruta relativa
    relative_path=$(realpath --relative-to="$SOURCE_DIR" "$file")
    
    # Escribir comentario con la ruta
    echo "// $relative_path" >> "$OUTPUT_FILE"
    
    # Escribir contenido del archivo
    cat "$file" >> "$OUTPUT_FILE"
    
    # Línea en blanco para separar archivos
    echo "" >> "$OUTPUT_FILE"
    
    ((count++))
done

echo "✅ $count archivos recopilados en: $OUTPUT_FILE"