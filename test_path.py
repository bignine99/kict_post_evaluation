import os

p = os.getenv('RAW_DATA_PATH', '/app/raw_data')
print('env path exists?', os.path.exists(p))

fallback = r"c:\Users\cho\Desktop\Temp\05 Code\260310_post_evaluation\.012_raw_data_report"
print('fallback path exists?', os.path.exists(fallback))

total = 0
for root, _, files in os.walk(fallback):
    for file in files:
        if file.lower().endswith('.pdf'):
            total += 1
print('total pdf files found in fallback:', total)
