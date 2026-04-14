# Use Bun base image
FROM oven/bun:latest

# Set the working directory inside the container
WORKDIR /app

# Copy package.json before installing dependencies
COPY package.json ./

# Install project dependencies
RUN bun install

# Copy the rest of the application files
COPY . .

# Expose port
EXPOSE 3000

# Start the application
CMD ["bun", "app.js"]
