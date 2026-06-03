#!/bin/bash
# 测试修复后的Prefab工具

echo "=== 测试1: validate_prefab ==="
curl -s -X POST http://localhost:8585/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"prefab_validate_prefab","arguments":{"prefabUuid":"15bcc556-b25a-47b6-b8cc-7ead1b6e0ac5"}}}' | python -c "import sys, json; d=json.load(sys); r=json.loads(d['result']['content'][0]['text']); print(json.dumps(r, indent=2))"

echo -e "\n=== 测试2: get_prefab_info ==="
curl -s -X POST http://localhost:8585/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"prefab_get_prefab_info","arguments":{"prefabUuid":"15bcc556-b25a-47b6-b8cc-7ead1b6e0ac5"}}}' | python -c "import sys, json; d=json.load(sys); r=json.loads(d['result']['content'][0]['text']); print(json.dumps(r, indent=2))"

echo -e "\n=== 测试3: instantiate_prefab ==="
RESPONSE=$(curl -s -X POST http://localhost:8585/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"prefab_instantiate_prefab","arguments":{"prefabUuid":"15bcc556-b25a-47b6-b8cc-7ead1b6e0ac5"}}}')
echo $RESPONSE | python -c "import sys, json; d=json.load(sys); r=json.loads(d['result']['content'][0]['text']); print(json.dumps(r, indent=2))"

# 提取节点UUID用于后续测试
NODE_UUID=$(echo $RESPONSE | python -c "import sys, json; d=json.load(sys); r=json.loads(d['result']['content'][0]['text']); print(r.get('data', {}).get('uuid', ''))" 2>/dev/null)
echo "实例化节点UUID: $NODE_UUID"

if [ -n "$NODE_UUID" ]; then
    echo -e "\n=== 测试4: 修改节点属性 ==="
    curl -s -X POST http://localhost:8585/mcp \
      -H "Content-Type: application/json" \
      -d "{\"jsonrpc\":\"2.0\",\"id\":4,\"method\":\"tools/call\",\"params\":{\"name\":\"node_set_node_property\",\"arguments\":{\"uuid\":\"$NODE_UUID\",\"property\":\"x\",\"value\":500}}}" | python -c "import sys, json; d=json.load(sys); r=json.loads(d['result']['content'][0]['text']); print(json.dumps(r, indent=2))"

    echo -e "\n=== 测试5: update_prefab ==="
    curl -s -X POST http://localhost:8585/mcp \
      -H "Content-Type: application/json" \
      -d "{\"jsonrpc\":\"2.0\",\"id\":5,\"method\":\"tools/call\",\"params\":{\"name\":\"prefab_update_prefab\",\"arguments\":{\"nodeUuid\":\"$NODE_UUID\",\"prefabUuid\":\"15bcc556-b25a-47b6-b8cc-7ead1b6e0ac5\"}}}" | python -c "import sys, json; d=json.load(sys); r=json.loads(d['result']['content'][0]['text']); print(json.dumps(r, indent=2))"

    echo -e "\n=== 清理: 删除实例节点 ==="
    curl -s -X POST http://localhost:8585/mcp \
      -H "Content-Type: application/json" \
      -d "{\"jsonrpc\":\"2.0\",\"id\":6,\"method\":\"tools/call\",\"params\":{\"name\":\"node_delete_node\",\"arguments\":{\"uuid\":\"$NODE_UUID\"}}}" | python -c "import sys, json; d=json.load(sys); r=json.loads(d['result']['content'][0]['text']); print(json.dumps(r, indent=2))"
fi

echo -e "\n=== 测试完成 ==="
