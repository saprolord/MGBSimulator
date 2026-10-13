import re

input_file = "ships.txt"
output_file = "output.txt"

# Map 3-digit sequences to your desired target output
RULE_MAP = {
    "000":".",
    "010": "#",
    "020": "^",
    "030": "E"
}


def translate_sequence(digit_str):
    """Chunks the digit string into 3-digit groups and maps each group using RULE_MAP."""
    result = []
    # Loop over the string in steps of 3
    for j in range(11):
        result.append("'")

        # Loop through 11 chunks of 3 within the current row (i = 0 to 10)
        for i in range(11):
            # Calculate exact start index for this chunk
            start = 3 + (j * 33) + (i * 3)
            chunk = digit_str[start : start + 3]

            # Translate using map
            if chunk in RULE_MAP:
                result.append(RULE_MAP[chunk])
            else:
                result.append(".")

        # Append trailing chars at end of row
        result.append("#',\n")
    return "".join(result)


with open(input_file, "r", encoding="utf-8") as infile, open(
    output_file, "w", encoding="utf-8"
) as outfile:
    while True:
        line = infile.readline()
        if line == "":  # EOF reached
            break
        else:
            if line.strip():  # Check if line is not empty
                # Process the current line and the next two lines
                line1 = line
                line2 = infile.readline()
                line3 = infile.readline()
                line4 = infile.readline()  
                if not line2 or not line3 or not line4:  # Check if we have enough lines
                    break
                
                outfile.write("{\n")
                outfile.write(f"id:'{line2.strip()[0:3]}',\n")
                outfile.write(f"name:'{line1.strip()}',\n")
                digits = line2.strip()
                encoded_digits = translate_sequence(digits)
                outfile.write(f"map: [\n'############',\n")
                outfile.write(f"{encoded_digits}],\n")
                outfile.write(f"fireRate:{line3.strip()},\n")
                outfile.write("},\n\n")
