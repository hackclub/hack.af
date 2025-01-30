# Use Node.js 23 base image
FROM node:23

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json before installing dependencies
COPY package*.json ./

# Install npm version 10.9.2
RUN npm install -g npm@10.9.2

# Install project dependencies
RUN npm install

# Copy the rest of the application files
COPY . .

# Expose port (change if needed)
EXPOSE 3000

# Start the application (modify based on your start script)
CMD ["npm", "start"]
