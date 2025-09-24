import subprocess
import re

def get_gpu_info():
    try:
        # Get GPU info using nvidia-ml-py or nvidia-smi
        result = subprocess.run(['nvidia-smi', '--query-gpu=name,compute_cap', '--format=csv,noheader,nounits'],
                               capture_output=True, text=True)

        if result.returncode == 0:
            gpu_info = result.stdout.strip()
            print(f"GPU Info: {gpu_info}")

            # RTX 3050 has compute capability 8.6
            if "RTX 3050" in gpu_info:
                print("Detected NVIDIA RTX 3050 - Compute Capability: 8.6")
                return "8.6"

        # Fallback: detect from GPU name
        name_result = subprocess.run(['nvidia-smi', '--query-gpu=name', '--format=csv,noheader'],
                                   capture_output=True, text=True)
        if name_result.returncode == 0:
            gpu_name = name_result.stdout.strip()
            print(f"GPU Name: {gpu_name}")

            # Common compute capabilities
            if "RTX 30" in gpu_name or "RTX 40" in gpu_name:
                if "3050" in gpu_name or "3060" in gpu_name:
                    return "8.6"
                elif "3070" in gpu_name or "3080" in gpu_name or "3090" in gpu_name:
                    return "8.6"
                elif "4060" in gpu_name or "4070" in gpu_name or "4080" in gpu_name or "4090" in gpu_name:
                    return "8.9"

    except Exception as e:
        print(f"Error getting GPU info: {e}")

    return "8.6"  # Default for RTX 3050

if __name__ == "__main__":
    compute_cap = get_gpu_info()
    print(f"Using compute capability: {compute_cap}")