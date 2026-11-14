extends Node3D

const GRID := 6
const BLOCK := 8.0
const ROAD := 3.0
const SAVE_PATH := "user://tiger_city_save.json"
const BUILD_COSTS := [250, 600, 1200]
const BUILD_SIZES := [Vector3(4, 4, 4), Vector3(5, 7, 5), Vector3(6, 13, 6)]
const BUILD_COLORS := [Color(0.78, 0.68, 0.52), Color(0.25, 0.48, 0.68), Color(0.35, 0.38, 0.43)]

var coins := 5000
var soldiers := 24
var supplies := 100
var selected_building := -1
var captured := 0
var status_label: Label
var stats_label: Label
var camera: Camera3D
var city_root: Node3D
var buildings: Array[Dictionary] = []
var yaw := 0.0
var pitch := 0.62
var camera_distance := 95.0
var active_touches: Dictionary = {}
var touch_start: Vector2
var touch_moved := false
var mouse_dragging := false
var last_touch_gap := 0.0
var last_pointer := Vector2.ZERO

func _ready() -> void:
	_build_world()
	_build_ui()
	_load_game()
	_update_ui()
	_update_camera()

func _build_world() -> void:
	city_root = Node3D.new()
	city_root.name = "GeneratedCity"
	add_child(city_root)
	_add_box("Ground", Vector3(0, -0.3, 0), Vector3(100, 0.5, 100), Color(0.20, 0.32, 0.20))
	for i in range(GRID + 1):
		var p := (float(i) - GRID / 2.0) * (BLOCK + ROAD)
		_add_box("RoadX", Vector3(0, 0.02, p), Vector3(100, 0.12, ROAD), Color(0.12, 0.13, 0.15))
		_add_box("RoadZ", Vector3(p, 0.02, 0), Vector3(ROAD, 0.12, 100), Color(0.12, 0.13, 0.15))
	var rng := RandomNumberGenerator.new()
	rng.seed = 303
	for x in range(GRID):
		for z in range(GRID):
			var px := (float(x) - GRID / 2.0 + 0.5) * (BLOCK + ROAD)
			var pz := (float(z) - GRID / 2.0 + 0.5) * (BLOCK + ROAD)
			var h := rng.randf_range(4.0, 15.0)
			_add_box("Building", Vector3(px, h / 2.0, pz), Vector3(rng.randf_range(3.5, 6.0), h, rng.randf_range(3.5, 6.0)), Color(0.45, 0.48, 0.52).lerp(Color(0.72, 0.65, 0.52), rng.randf()))
	for i in range(5):
		var angle := TAU * float(i) / 5.0
		_add_box("Rival district", Vector3(cos(angle) * 62.0, 2.0, sin(angle) * 62.0), Vector3(9, 4, 9), Color(0.62, 0.18, 0.15))
	_add_box("Capital", Vector3(0, 3, 0), Vector3(12, 6, 12), Color(0.82, 0.64, 0.22))
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-52, -30, 0)
	sun.light_energy = 1.4
	add_child(sun)
	camera = Camera3D.new()
	camera.current = true
	add_child(camera)

func _add_box(label: String, pos: Vector3, size: Vector3, tint: Color) -> MeshInstance3D:
	var mesh := BoxMesh.new()
	mesh.size = size
	var item := MeshInstance3D.new()
	item.name = label
	item.mesh = mesh
	item.position = pos
	var material := StandardMaterial3D.new()
	material.albedo_color = tint
	item.material_override = material
	city_root.add_child(item)
	return item

func _update_camera() -> void:
	if camera == null:
		return
	var target := Vector3(0, 0, 0)
	var horizontal := camera_distance * cos(pitch)
	camera.position = target + Vector3(sin(yaw) * horizontal, camera_distance * sin(pitch), cos(yaw) * horizontal)
	camera.look_at(target, Vector3.UP)

func _build_ui() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)
	var panel := PanelContainer.new()
	panel.position = Vector2(16, 16)
	panel.custom_minimum_size = Vector2(290, 0)
	layer.add_child(panel)
	var column := VBoxContainer.new()
	panel.add_child(column)
	var heading := Label.new()
	heading.text = "TIGER CITY 3D"
	heading.add_theme_font_size_override("font_size", 25)
	column.add_child(heading)
	stats_label = Label.new()
	column.add_child(stats_label)
	for pair in [["HOUSE", 0], ["SHOP", 1], ["OFFICE", 2]]:
		var button := Button.new()
		button.text = "SELECT " + pair[0]
		var kind: int = pair[1]
		button.pressed.connect(func(): _select_building(kind))
		column.add_child(button)
	var recruit := Button.new()
	recruit.text = "RECRUIT 5 SOLDIERS (-20)"
	recruit.pressed.connect(_recruit)
	column.add_child(recruit)
	var attack := Button.new()
	attack.text = "ATTACK NEIGHBOUR (-15)"
	attack.pressed.connect(_attack)
	column.add_child(attack)
	var save_button := Button.new()
	save_button.text = "SAVE GAME"
	save_button.pressed.connect(_save_game)
	column.add_child(save_button)
	var load_button := Button.new()
	load_button.text = "LOAD GAME"
	load_button.pressed.connect(_load_game)
	column.add_child(load_button)
	status_label = Label.new()
	status_label.text = "Drag to rotate • Pinch to zoom • Select a building, then tap the city."
	status_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	column.add_child(status_label)

func _select_building(kind: int) -> void:
	selected_building = kind
	status_label.text = "Selected " + ["House", "Shop", "Office"][kind] + ". Tap an open place in the city to build."

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		var touch := event as InputEventScreenTouch
		if touch.pressed:
			active_touches[touch.index] = touch.position
			if active_touches.size() == 1:
				touch_start = touch.position
				touch_moved = false
			elif active_touches.size() == 2:
				var points: Array = active_touches.values()
				last_touch_gap = points[0].distance_to(points[1])
		else:
			active_touches.erase(touch.index)
			if active_touches.is_empty() and not touch_moved and selected_building >= 0:
				_try_place_at(touch.position)
	elif event is InputEventScreenDrag:
		var drag := event as InputEventScreenDrag
		active_touches[drag.index] = drag.position
		if active_touches.size() >= 2:
			var points: Array = active_touches.values()
			var current_gap: float = points[0].distance_to(points[1])
			if last_touch_gap > 0.0:
				camera_distance = clampf(camera_distance - (current_gap - last_touch_gap) * 0.12, 38.0, 145.0)
			last_touch_gap = current_gap
			touch_moved = true
		else:
			yaw -= drag.relative.x * 0.006
			pitch = clampf(pitch + drag.relative.y * 0.004, 0.18, 1.25)
			touch_moved = true
		_update_camera()
	elif event is InputEventMouseButton:
		var mouse := event as InputEventMouseButton
		if mouse.button_index == MOUSE_BUTTON_LEFT:
			mouse_dragging = mouse.pressed
			last_pointer = mouse.position
			if mouse.pressed:
				touch_moved = false
			if not mouse.pressed and not touch_moved and selected_building >= 0:
				_try_place_at(mouse.position)
		elif mouse.button_index == MOUSE_BUTTON_WHEEL_UP and mouse.pressed:
			camera_distance = maxf(38.0, camera_distance - 5.0)
			_update_camera()
		elif mouse.button_index == MOUSE_BUTTON_WHEEL_DOWN and mouse.pressed:
			camera_distance = minf(145.0, camera_distance + 5.0)
			_update_camera()
	elif event is InputEventMouseMotion and mouse_dragging:
		var motion := event as InputEventMouseMotion
		yaw -= motion.relative.x * 0.006
		pitch = clampf(pitch + motion.relative.y * 0.004, 0.18, 1.25)
		touch_moved = true
		_update_camera()

func _try_place_at(screen_position: Vector2) -> void:
	if selected_building < 0 or coins < BUILD_COSTS[selected_building]:
		status_label.text = "Select a building and make sure you have enough coins."
		return
	var origin := camera.project_ray_origin(screen_position)
	var direction := camera.project_ray_normal(screen_position)
	var ground := Plane(Vector3.UP, 0.0)
	var hit = ground.intersects_ray(origin, direction)
	if hit == null:
		return
	var point: Vector3 = hit
	if absf(point.x) > 43.0 or absf(point.z) > 43.0:
		status_label.text = "Choose a building site inside the city."
		return
	var size: Vector3 = BUILD_SIZES[selected_building]
	var snapped := Vector3(roundf(point.x / 2.0) * 2.0, size.y / 2.0, roundf(point.z / 2.0) * 2.0)
	for entry in buildings:
		var existing: Vector3 = entry.position
		if Vector2(existing.x, existing.z).distance_to(Vector2(snapped.x, snapped.z)) < 6.0:
			status_label.text = "That building site is occupied."
			return
	var item := _add_box("Player building", snapped, size, BUILD_COLORS[selected_building])
	buildings.append({"position": snapped, "kind": selected_building, "node": item})
	coins -= BUILD_COSTS[selected_building]
	status_label.text = "Building placed. Save your city to keep your progress."
	_update_ui()

func _recruit() -> void:
	if supplies < 20:
		status_label.text = "Not enough supplies to recruit."
		return
	supplies -= 20
	soldiers += 5
	status_label.text = "Five soldiers joined your army."
	_update_ui()

func _attack() -> void:
	if supplies < 15 or soldiers < 8 or captured >= 5:
		status_label.text = "Need 8 soldiers, 15 supplies, and an uncaptured district."
		return
	supplies -= 15
	var strength := soldiers + randi_range(-8, 8)
	if strength >= 20 + captured * 3:
		captured += 1
		soldiers = maxi(4, soldiers - 5)
		status_label.text = "Victory! You captured a neighbouring district."
	else:
		soldiers = maxi(2, soldiers - 8)
		status_label.text = "The invasion failed. Regroup and recruit more soldiers."
	_update_ui()

func _save_game() -> void:
	var saved_buildings: Array[Dictionary] = []
	for entry in buildings:
		var p: Vector3 = entry.position
		saved_buildings.append({"x": p.x, "z": p.z, "kind": entry.kind})
	var data := {"coins": coins, "soldiers": soldiers, "supplies": supplies, "captured": captured, "buildings": saved_buildings}
	var file := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if file == null:
		status_label.text = "Could not save the game on this device."
		return
	file.store_string(JSON.stringify(data))
	status_label.text = "Game saved on this device."
	file.close()

func _load_game() -> void:
	if not FileAccess.file_exists(SAVE_PATH):
		status_label.text = "No saved game found yet."
		return
	var file := FileAccess.open(SAVE_PATH, FileAccess.READ)
	if file == null:
		status_label.text = "Could not read the saved game."
		return
	var parsed = JSON.parse_string(file.get_as_text())
	file.close()
	if typeof(parsed) != TYPE_DICTIONARY:
		status_label.text = "Saved game data is invalid."
		return
	coins = int(parsed.get("coins", 5000))
	soldiers = int(parsed.get("soldiers", 24))
	supplies = int(parsed.get("supplies", 100))
	captured = int(parsed.get("captured", 0))
	for item in buildings:
		var node = item.get("node")
		if is_instance_valid(node):
			node.queue_free()
	buildings.clear()
	for entry in parsed.get("buildings", []):
		var kind := clampi(int(entry.get("kind", 0)), 0, 2)
		var size: Vector3 = BUILD_SIZES[kind]
		var pos := Vector3(float(entry.get("x", 0.0)), size.y / 2.0, float(entry.get("z", 0.0)))
		var node := _add_box("Player building", pos, size, BUILD_COLORS[kind])
		buildings.append({"position": pos, "kind": kind, "node": node})
	status_label.text = "Saved city loaded."
	_update_ui()

func _update_ui() -> void:
	if stats_label:
		stats_label.text = "Coins: %d\nSoldiers: %d\nSupplies: %d\nDistricts captured: %d/5" % [coins, soldiers, supplies, captured]
