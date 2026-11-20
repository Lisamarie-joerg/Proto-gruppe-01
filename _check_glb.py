import struct, json
data = open('webapp/static/model.glb', 'rb').read()
magic, version, length = struct.unpack('<III', data[:12])
print('magic:', magic.to_bytes(4, 'little'), '| version:', version, '| gltf_length:', length, '| file_size:', len(data), '| match:', length == len(data))
clen, ctype = struct.unpack('<II', data[12:20])
print('json chunk:', clen, 'bytes, type:', ctype.to_bytes(4, 'little'))
gltf = json.loads(data[20:20 + clen])
print('scenes:', gltf['scenes'])
print('nodes:', len(gltf['nodes']), '| meshes:', len(gltf['meshes']), '| materials:', len(gltf['materials']),
      '| accessors:', len(gltf['accessors']), '| bufferViews:', len(gltf['bufferViews']))
print('buffers:', gltf['buffers'])
ln = [n for n in gltf['nodes'] if n.get('extras', {}).get('isLayerNode')]
print('Layer-Knoten:', len(ln))
for n in ln: print('   ', n['name'], '->', len(n.get('children', [])), 'Objekte |', n['extras']['layer'])
mn = [n for n in gltf['nodes'] if n.get('mesh') is not None]
print('Objekt-Knoten:', len(mn))
print('Mesh-Beispiel:', json.dumps(mn[0], ensure_ascii=False)[:400])
print('Material-Beispiel:', json.dumps(gltf['materials'][0]))
modes = {}
for m in gltf['meshes']:
    md = m['primitives'][0].get('mode', 4)
    modes[md] = modes.get(md, 0) + 1
print('Primitive-Modi (4=Triangles, 1=Lines):', modes)
