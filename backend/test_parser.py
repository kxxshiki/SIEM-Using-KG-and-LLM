from app.services.log_parser_service import parse_file_content

sample = """timestamp,src_ip,dst_ip,src_port,dst_port,protocol,bytes_sent,bytes_received,user_agent,url,is_internal_traffic,label,attack_type
2025-10-01 00:12:54,188.176.27.165,253.240.113.218,56377,445,TCP,8029,17204,test-agent,https://example.com,False,0,benign
"""
rows = parse_file_content(sample, "test_network.csv")

print("Parsed rows:", len(rows))
print("Source IP:", rows[0].get("ip_address"))
print("Timestamp:", rows[0].get("timestamp"))
print("Platform:", rows[0].get("platform"))
print("Raw log:", rows[0].get("raw_log"))