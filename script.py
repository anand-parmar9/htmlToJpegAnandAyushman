import sys

# sys.argv holds command line arguments
# sys.argv[0] -> script name
# sys.argv[1], sys.argv[2]... -> passed args

print("Arguments from Node.js:", sys.argv[1:])

# Example: process data
result = [arg.upper() for arg in sys.argv[1:]]
print("Processed:", result)
