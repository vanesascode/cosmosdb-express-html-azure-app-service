#!/bin/bash
set -e

# ============================================
# Script de Deployment para Azure App Service
# ============================================

# Variables de configuración
RG_NAME="mi-grupo"
APP_NAME="mi-app-cosmosdb"

echo "🔨 Building project..."
npm run build

echo ""
echo "📦 Creating deployment package..."
rm -rf deploy_package
mkdir -p deploy_package

# Copiar archivos necesarios
echo "  Copying compiled files..."
cp -r dist/* deploy_package/
cp package.json deploy_package/
cp package-lock.json deploy_package/

echo "  Creating ZIP file..."
cd deploy_package
python -c "
import zipfile
import os

print('  Adding files to ZIP:')
with zipfile.ZipFile('../deploy.zip', 'w', zipfile.ZIP_DEFLATED) as zipf:
    for root, dirs, files in os.walk('.'):
        for file in files:
            file_path = os.path.join(root, file)
            arcname = os.path.relpath(file_path, '.')
            zipf.write(file_path, arcname)
            print(f'    ✓ {arcname}')
"
cd ..

echo ""
echo "🚀 Deploying to Azure..."
az webapp deploy \
  --resource-group "$RG_NAME" \
  --name "$APP_NAME" \
  --src-path deploy.zip \
  --type zip \
  --async false

# Limpiar archivos temporales
echo ""
echo "🧹 Cleaning up..."
rm -rf deploy_package deploy.zip

echo ""
echo "✅ Deployment complete!"
echo "🌐 Your app is available at: https://${APP_NAME}.azurewebsites.net"
echo ""
echo "📊 Useful commands:"
echo "  View logs:    az webapp log tail --name $APP_NAME --resource-group $RG_NAME"
echo "  Test health:  curl https://${APP_NAME}.azurewebsites.net/api/health"
echo "  Restart app:  az webapp restart --name $APP_NAME --resource-group $RG_NAME"
