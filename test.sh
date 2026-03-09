set -e

# Function to check if a command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Check if npm is installed
if ! command_exists npm; then
  echo "npm not found. Please install npm to run the tests."
  exit 1
fi

# Check if shx is installed
if ! npm list shx >/dev/null 2>&1; then
  echo "shx not found. Please install shx to run the tests."
  exit 1
fi

# Run the build script
npm run build

# Check if the build was successful
if [ $? -eq 0 ]; then
  echo "Build successful."
else
  echo "Build failed."
  exit 1
fi
