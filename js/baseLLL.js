/**
 * Created by SF3298 on 2019/7/16.
 */
var ThreeInitialize_LLL = function(){

    var thm = this;
    var is_Init = false,df_raf = undefined;
    var df_Point = undefined;
    var df_Clock = undefined;
    let pickObject = [];
    let mixers = [];

    var df_Config = {
        background: { color: '#000', opacity: 0 },
        camera: { fov: 45, near: 0.1, far: 1000, position: [0, 100, 100] },
        controls: {
            enabled:true, enableZoom:true, enableRotate:true, enablePan: true, screenSpacePanning: false,
            zoomSpeed: 1, rotateSpeed:1, panSpeed: 1,
            target:[0,0,0], distance:[0, Infinity], polarAngle:[0, Math.PI], azimuthAngle: [-Infinity, Infinity]
        },
        texture: {
        }
    };

    this.init = function ( cts, config ) {
        let conts = parseCts(cts);
        if ( detector() && conts != null) {
            // try {
                df_Config = $.extend( true, {}, df_Config, (config || {}) );

                thm.parentCont = conts;
                thm.GId += THREE.Math.generateUUID();
                let TId = conts.attr('id') +'_'+thm.GId;
                thm.container = creatContainer( TId );
                thm.parentCont.html( thm.container );

                _setControls();
                _initThreeJs();

                _Collects.loadTexture(); // 加载纹理
                initiate();
                is_Init = true;
            // } catch (e) {
            //     thm.Result = 'error! Initialization Error!';
            //     creatError(conts);
            //     return;
            // }
        } else thm.Result = 'error! Not Support WebGL!';
    };
    //-
    this.onMouseDownEvent = function ( func ) {
        // df_onMouseDownEvent = toFunction(func);
    };
    //-
    this.render = function () {
        if (is_Init) {
            renderers();
        }
    };
    //-
    this.disposeRender = function() {
        if (is_Init) {
            is_Init = false;
        }
    };
    //-
    this.loadFBX = function (url, callback) {
        // 配置项
        let {mtl, rotate, scale, path, speed} = df_Config.model;

        let loader = new THREE.FBXLoader();
        loader.load(url, function (object) {

            object.mixer = new THREE.AnimationMixer( object );
            mixers.push( object.mixer );
            let action = object.mixer.clipAction( object.animations[0] );
            action.play();

            object.name = 'group';
            let child = object.getObjectByName('1');
            setMaterial(child, mtl);

            // 形状数据
            let p = path[0];
            let shape = new THREE.Shape();
            shape.moveTo(p.x, p.y);// 起始点
            for(let i=1, len=path.length; i<len; i++){

                p = path[i];
                shape.lineTo(p.x, p.y);
            }
            let points = shape.getSpacedPoints((shape.getLength())/speed);//获取平分点数据
            object.userData = {
                index: 0,
                points: points
            };
            object.rotateX(rotate);
            object.position.set(points[0].x, points[0].y, 0);
            object.scale.set(scale, scale, scale);

            !thm.carObject && (thm.carObject = _Collects.obj());
            thm.carObject.userData.index = thm.carObject.children.length; // 无人机索引值
            thm.carObject.add(object);

            callback && callback();

        });

        function setMaterial(object, names){
            // 修改材质属性
            if(Array.isArray(object.material)){
                object.material.forEach((material)=>{
                    updateMaterial(material);
                });
            }else{
                updateMaterial(object.material);
            }
            // 材质修改
            function updateMaterial(material){

                let infor = names[material.name];
                if(infor){
                    // 修改颜色
                    material.color.set(infor);
                }
            }
        }
    };
    //-
    this.loadFBXWindmill = function (url, callback){
        // 配置项
        let { name, scale, offsetY, points } = df_Config.windmill;

        let loader = new THREE.FBXLoader();
        thm.windmill = [];
        loader.load(url, function (object) {

            object.scale.set(scale, scale, scale);
            object.rotateZ(Math.PI * 0.7);
            // object.rotateY(-Math.PI * 0.04);

            points.forEach((p)=>{

                let obj = object.clone();

                let windmill = obj.getObjectByName(name);
                thm.windmill.push(windmill);

                obj.position.copy(p);
                obj.position.y += offsetY;
                thm.scene.add(obj);
            });

            callback && callback();

        });

    };
    //- 获取无人机位置数据
    this.getFlyPosition = function(fun){

        df_Point = toFunction(fun);
    };

    function initiate () {

        df_Clock = new THREE.Clock();
        thm.scene = _Collects.createScene();

        //camera
        let wh = getWH();
        let cm = df_Config.camera;
        thm.camera = _Collects.createCamera(wh, cm.fov, cm.near, cm.far, cm.position, [0,0,0]);

        //renderer
        thm.renderer = _Collects.createRenderer(wh.w, wh.h);
        thm.container.append( $(thm.renderer.domElement) );

        // controls
        thm.controls = createControls( thm.camera, thm.renderer.domElement );

        initLight();

        thm.raycaster = new THREE.Raycaster();

        initObject();
    }

    //-
    var _Shaders = {
        // 水
        WaterVShader: [

            "varying vec2 vUv;",

            "void main(){",

            "vUv = uv;",
            "gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
            "}"
        ].join("\n"),
        WaterFShader: [

            "uniform sampler2D iChannel0;",
            "uniform sampler2D iChannel1;",
            "uniform sampler2D iChannel2;",
            "uniform vec3 uColor;",
            "uniform float uOpacity;",
            "uniform float time;",
            "uniform float speed;",

            "varying vec2 vUv;",

            "float rand(vec2 n) { return 0.5 + 0.5 * fract(sin(dot(n.xy, vec2(12.9898, 78.233)))* 43758.5453); }",

            "float water(vec3 p) {",
            "float t = time*speed / 3.;",
            "p.z += t * 2.; p.x += t * 2.;",
            "vec3 c1 = texture2D(iChannel2, p.xz / 10.).xyz;",
            "p.z += t * 3.; p.x += t * 0.52;",
            "vec3 c2 = texture2D(iChannel2, p.xz / 10.).xyz;",
            "p.z += t * 4.; p.x += t * 0.8;",
            "vec3 c3 = texture2D(iChannel2, p.xz / 10.).xyz;",
            "c1 += c2 - c3;",
            "float z = (c1.x + c1.y + c1.z) / 3.;",
            "return p.y + z / 4.;",
            "}",

            "float map(vec3 p) {",
            "float d = 10.0;",
            "d = water(p);",
            "return d;",
            "}",

            "float intersect(vec3 ro, vec3 rd) {",
            "float d = 0.0;",
            "for (int i = 0; i <= 10; i++) {",
            "float h = map(ro + rd * d);",
            "if (h < 0.1) return  d;",
            "d += h;",
            "}",
            "return 0.0;",
            "}",

            "vec3 norm(vec3 p) {",
            "float eps = .1;",
            "return normalize(vec3(",
            "map(p + vec3(eps, 0, 0)) - map(p + vec3(-eps, 0, 0)),",
            "map(p + vec3(0, eps, 0)) - map(p + vec3(0, -eps, 0)),",
            "map(p + vec3(0, 0, eps)) - map(p + vec3(0, 0, -eps))",
            "));",
            "}",

            "void main(){",

            "vec2 uv = vUv - 0.5;",

            "vec3 l1 = normalize(vec3(1, 1, 1));",
            "vec3 ro = vec3(-3, 10, -5);",//-3,7,-5
            "vec3 rc = vec3(0, 0, 0);",
            "vec3 ww = normalize(rc - ro);",
            "vec3 uu = normalize(cross(vec3(0,1,0), ww));",
            "vec3 vv = normalize(cross(rc - ro, uu));",
            "vec3 rd = normalize(uu * uv.x + vv * uv.y + ww);",
            "float d = intersect(ro, rd);",
            "vec3 c = vec3(0.0);",
            "if (d > 0.0) {",
            "vec3 p = ro + rd * d;",
            "vec3 n = norm(p);",
            "float spc = pow(max(0.0, dot(reflect(l1, n), rd)), 30.0);",
            "vec4 ref = texture2D(iChannel0, normalize(reflect(rd, n)).xy);",
            "vec3 rfa = texture2D(iChannel1, (p+n).xz / 6.0).xyz * (8./d);",
            "c = rfa.xyz + (ref.xyz * 0.5)+ spc;",
            "}",

            "gl_FragColor = vec4((c*uColor - 0.5) * 1.1 + 0.5, uOpacity);",
            // "gl_FragColor = vec4(c, uOpacity );",

            "}"
        ].join("\n")
    };
    var _Collects = {

        obj: function () { return new THREE.Object3D(); },
        color: function ( c ) { return new THREE.Color(c); },

        createScene: function() {

            let scene = new THREE.Scene();
            return scene;
        },
        createCamera: function( wh, fov, near, far, position, target ) {

            let camera = new THREE.PerspectiveCamera( fov, wh.w / wh.h, near, far );
            camera.position.set(position[0],position[1],position[2]);
            camera.lookAt( new THREE.Vector3(target[0], target[1], target[2]));

            return camera;
        },
        createRenderer: function( w, h ) {

            let bg = df_Config.background;
            let renderer = new THREE.WebGLRenderer( { antialias: true, alpha: true } );
            // renderer.sortObjects = false;
            renderer.setSize( w, h );
            renderer.setClearColor( bg.color, bg.opacity );

            return renderer;
        },

        // 加载纹理
        loadTexture: function () {
            let txueLoader = new THREE.TextureLoader();
            let _n = df_Config.texture;
            df_Config.txues = {};
            for ( var k in _n ) {
                df_Config.txues['_'+k] = txueLoader.load( _n[k], function(texture){
                    texture.minFilter = THREE.LinearFilter;
                    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
                });
            }
        }
    };

    function initObject(){

        pickPlane();

        // 时间
        thm.time = {value: 0};
        initWater();
        // 初始化小小车车
        initCars();

        df_Config.isPick && thm.container[0].addEventListener('click', onClick, false);
    }

    function pickPlane(){

        if(!df_Config.isPick) return;

        let plane = new THREE.Mesh(new THREE.PlaneBufferGeometry(40, 40), new THREE.MeshBasicMaterial({
            color: '#ff0000',
            transparent: true,
            opacity: 0.2
        }));
        pickObject.push(plane);
        thm.scene.add( plane);
    }
    // 初始化河流
    function initWater(){
        // 配置项
        let { datas, color, opacity, speed, holes } = df_Config.water;
        holes = holes || {};
        // 材质对象
        let mtl = new THREE.ShaderMaterial({
            uniforms: {
                iChannel0: { value: df_Config.txues._iChannel0 },
                iChannel1: { value: df_Config.txues._iChannel1 },
                iChannel2: { value: df_Config.txues._iChannel2 },
                uColor: { value: new THREE.Color(color) },
                uOpacity: { value: opacity },
                speed: { value: speed },
                time: thm.time
            },
            blending: THREE.AdditiveBlending,
            transparent: true,
            // depthTest: false,
            vertexShader: _Shaders.WaterVShader,
            fragmentShader: _Shaders.WaterFShader
        });
        // 创建河流对象
        datas.forEach((points)=>{
            // 点数据
            let p = points[0];

            // 形状数据
            let shape = new THREE.Shape();
            shape.moveTo(p.x, p.y);// 起始点
            for(let i=1, len=points.length; i<len; i++){

                p = points[i];
                shape.lineTo(p.x, p.y);
            }
            p = points[0];
            shape.lineTo(p.x, p.y);

            // let points0 = shape.getPoints();
            // let geometryPoints = new THREE.BufferGeometry().setFromPoints( points0 );
            // let line = new THREE.Line( geometryPoints, new THREE.LineBasicMaterial( { color: '#ffff00' } ) );
            // thm.scene.add(line);

            let geometry = new THREE.ShapeBufferGeometry( shape );
            geometry.computeBoundingBox();
            let { max, min } = geometry.boundingBox;
            let maxS = max.x - min.x, maxT = max.y - min.y;

            //重新计算纹理数据--uvs
            let uvs = geometry.attributes.uv;
            for(let i=0, len=uvs.count; i<len; i++){

                let s = uvs.getX(i), t = uvs.getY(i);
                uvs.setXY(i, t/maxT, s/maxS,);
            }
            uvs.needsUpdate = true;

            let water = new THREE.Mesh(geometry, mtl);
            thm.scene.add( water );
        });
    }
    // 初始化小车车
    function initCars(){
        // 配置项
        let { datas } = df_Config.car;
        // 小车车对象集合
        !thm.carObject && (thm.carObject = _Collects.obj());
        // 创建小车车对象
        datas.forEach((infor)=>{
            // 纹理对象
            let map = df_Config.txues['_'+infor.name];

            // 点数据
            let points = infor.path;
            let p = points[0];
            // 形状数据
            let shape = new THREE.Shape();
            shape.moveTo(p.x, p.y);// 起始点
            for(let i=1, len=points.length; i<len; i++){

                p = points[i];
                shape.lineTo(p.x, p.y);
            }

            let lL = shape.getLength();
            let lineLength = lL/infor.speed;
            let tPoints = shape.getSpacedPoints(lineLength);//获取平分点数据
            // 计算角度值
            let angles = [];
            for(let i=0, len=tPoints.length-1; i<len; i++){

                let vec = tPoints[i+1].clone().sub(tPoints[i]);
                let angle = (new THREE.Vector3(vec.x, vec.y, 0)).angleTo(new THREE.Vector3(1, 0, 0));
                let key = vec.y <= 0? -1 : 1;
                key = vec.x <= 0? -key: key;
                angles.push([key*angle, vec.x <= 0? Math.PI: 0]);
            }
            angles.push([0,0]);

            // 车对象
            let geometry = new THREE.PlaneBufferGeometry( infor.size[0], infor.size[1]);
            let car = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
                transparent: true,
                // color: '#ff0000',
                side: THREE.DoubleSide,
                map: map
            }));
            car.position.set(tPoints[0].x, tPoints[0].y, 0);
            car.userData = {
                index: 0,
                points: tPoints,
                angles: angles
            };
            thm.carObject.add( car );

            // let points0 = shape.getPoints();
            // let geometryPoints = new THREE.BufferGeometry().setFromPoints( points0 );
            // let line = new THREE.Line( geometryPoints, new THREE.LineBasicMaterial( { color: '#ffff00' } ) );
            // thm.scene.add(line);
        });

        thm.scene.add(thm.carObject);
    }

    function initLight(){

        let light = new THREE.DirectionalLight( '#ffffff', 1);
        light.position.set(5,10,7.5);
        thm.scene.add( light );

        light = new THREE.HemisphereLight( '#B6B6B6', '#ffffff', 0.5);
        light.position.set(0, 10, 0);
        thm.scene.add( light );
    }

    function createControls(camera, container){

        let infor = df_Config.controls;

        let controls = new THREE.OrbitControls( camera, container );
        controls.target = new THREE.Vector3( infor.target[0], infor.target[1], infor.target[2] );

        controls.enabled = infor.enabled;

        controls.enableZoom = infor.enableZoom;
        controls.zoomSpeed = infor.zoomSpeed;
        controls.enableRotate = infor.enableRotate;
        controls.rotateSpeed = infor.rotateSpeed;
        controls.enablePan = infor.enablePan;
        controls.panSpeed = infor.panSpeed;

        controls.screenSpacePanning = infor.screenSpacePanning;
        //缩放距离
        controls.minDistance = infor.distance[0];
        controls.maxDistance = infor.distance[1];

        controls.minPolarAngle = infor.polarAngle[0];
        controls.maxPolarAngle = infor.polarAngle[1];

        controls.minAzimuthAngle = infor.azimuthAngle[0];
        controls.maxAzimuthAngle = infor.azimuthAngle[1];

        controls.update();

        return controls;
    }

    function transCoord(position) {

        let wh = getWH();

        let halfW = wh.w * 0.5,
            halfH = wh.h * 0.5,
            vec3 = position.clone().applyMatrix4(thm.scene.matrix).project(thm.camera),
            mx = Math.round(vec3.x * halfW + halfW),
            my = Math.round(-vec3.y * halfH + halfH);

        return new THREE.Vector2(mx, my);
    }

    // event
    function onClick( ev ) {

        var e = ev||event||arguments[0];
        if(!e) return;

        var point = e.changedTouches?e.changedTouches[0]:e;
        e.preventDefault();

        var wh = getWH();
        var mouse = new THREE.Vector2();
        mouse.x = ( point.clientX / wh.w ) * 2 - 1;
        mouse.y = - ( point.clientY / wh.h ) * 2 + 1;

        thm.raycaster.setFromCamera( mouse, thm.camera );
        var intersects = thm.raycaster.intersectObjects( pickObject );
        if ( intersects.length > 0 ) {
            // 拾取点信息
            let p = intersects[0].point;
            if( p && df_Config.isPick){
                console.log( 'new THREE.Vector3('+p.x+', '+p.y+', '+p.z+'),' );
            }
        }
    }

    function animation ( dt ) {

        thm.time.value += dt;

        // 小车车运动动画
        thm.carObject && thm.carObject.children.forEach((child)=>{

            let { index, points, angles } = child.userData;

            let pos = points[index];
            child.position.set(pos.x, pos.y, 0);

            if(angles){
                let angle = angles[index];
                child.rotation.x = angle[1];
                child.rotation.z = angle[0];
            }else{

                child.rotation.z += 0.005;
            }

            index++;
            index>=points.length&&(index =0);
            child.userData.index = index;
        });

        // 模型骨骼动画
        if ( mixers.length > 0 ) {

            for (let i = 0; i < mixers.length; i ++){

                mixers[i].update( dt );
            }
        }

        if(thm.windmill){

            let {rotate, speed} = df_Config.windmill;
            thm.windmill.forEach((windmill)=>{

                windmill.rotation[rotate] += speed;
            });
        }
    }

    function renderers () {
        (function Animations() {
            if (is_Init) {
                df_raf = window.requestAnimationFrame(Animations);

                var delta = df_Clock.getDelta();
                if (delta > 0) animation(delta);

                if(thm.carObject && thm.carObject.userData.index!==undefined && df_Point){

                    let obj = thm.carObject.children[thm.carObject.userData.index];
                    df_Point(transCoord(obj.position));
                }

                thm.renderer.render(thm.scene, thm.camera);
            } else {
                df_raf && window.cancelAnimationFrame(df_raf);
                //-
                removeEvents();
                disposeScene();
            }
        })();
    }

    //-
    function disposeScene(){
        //-
        thm.renderer.dispose();
        thm.renderer.forceContextLoss();
        thm.renderer.domElement = null;
        thm.controls.dispose();

        df_raf = null;
        df_Config = null;
        df_Clock = null;

        _Collects = null;
        _Shaders = null;

        mixers = null;
        pickObject = null;
        df_Point = null;
        thm.windmill = null;
        thm.carObject = null;
        thm.raycaster = null;

        disposeObj(thm.scene);

        thm.scene = null;
        thm.camera = null;
        thm.renderer = null;
        thm.controls = null;

        thm.container.remove();
        thm.container = null;

        thm = null;
        renderers = null;
    }

    //-
    function removeEvents() {

        thm.container[0].removeEventListener('click', onClick, false);
    }

    //-
    function disposeObj(obj) {
        if (obj instanceof THREE.Object3D) {

            objectTraverse(obj, function(child) {
                //- geometry
                if (child.geometry) {
                    if (child.geometry._bufferGeometry) {
                        child.geometry._bufferGeometry.dispose();
                    }
                    child.geometry.dispose();
                    child.geometry = null;

                    //- material
                    if (Array.isArray(child.material)) {
                        child.material.forEach(function(mtl) {
                            disposeMaterial(mtl);
                        });
                    }else{
                        disposeMaterial(child.material);
                    }
                    child.material = null;
                }
                if (child.parent) child.parent.remove(child);
                child = null;
            });
        }
        obj = null;
    }
    function objectTraverse(obj, callback) {
        if (!callback) return;
        let children = obj.children;
        for (let i = children.length - 1; i >= 0; i--) {
            objectTraverse(children[i], callback);
        }
        callback(obj);
    }
    function disposeMaterial(mtl) {
        if (mtl.uniforms){
            for(let i in mtl.uniforms){
                let uniform = mtl.__webglShader?mtl.__webglShader.uniforms[i]:undefined;
                if (uniform && uniform.value ) {
                    uniform.value.dispose&&uniform.value.dispose();
                    uniform.value = null;
                }
                uniform = mtl.uniforms[i];
                if(uniform.value){

                    uniform.value.dispose&&uniform.value.dispose();
                    uniform.value = null;
                }
            }
        }
        if (mtl.map) {
            mtl.map.dispose();
            mtl.map = null;
            if (mtl.__webglShader) {
                mtl.__webglShader.uniforms.map.value.dispose();
                mtl.__webglShader.uniforms.map.value = null;
            }
        }
        mtl.dispose();
        mtl = null;
    }

    function toFunction ( a ) {
        var b = Object.prototype.toString.call(a) === '[object Function]';
        return b? a: function(o){};
    }

    function getWH () {
        return { w: thm.container.width(), h: thm.container.height() };
    }
    function detector () {
        try {
            return !! window.WebGLRenderingContext && !! document.createElement('canvas').getContext('experimental-webgl');
        } catch( e ) { return false; }
    }
    function parseCts ( cts ) {
        var $dom = ( typeof cts == 'object' )? $(cts): $('#'+cts);
        if ( $dom.length <= 0 ) return null;
        return $dom;
    }

    function creatContainer ( id ) {
        var containers = $('<div></div>');
        containers.css("cssText", "height:100%;width:100%;position:relative !important");
        containers.attr('id', id);
        return containers;
    }
    function creatError ( conts, errorText ) {
        var error = $('<div class="data-error"></div>'),
            error_text = errorText || '数据错误。。。';
        if( undefined != conts ) {
            var ctxt = "color:#fff;position:absolute;top:49%;width:100%;text-align:center;";
            error.css("cssText", ctxt);
            conts.html( error.html(error_text) );
        }
    }

};

function _setControls() {
    THREE.OrbitControls=function(object,domElement){this.object=object;this.domElement=(domElement!==undefined)?domElement:document;this.enabled=true;this.target=new THREE.Vector3();this.minDistance=0;this.maxDistance=Infinity;this.minZoom=0;this.maxZoom=Infinity;this.minPolarAngle=0;this.maxPolarAngle=Math.PI;this.minAzimuthAngle=-Infinity;this.maxAzimuthAngle=Infinity;this.enableDamping=false;this.dampingFactor=0.25;this.enableZoom=true;this.zoomSpeed=1;this.enableRotate=true;this.rotateSpeed=1;this.enablePan=true;this.panSpeed=1;this.screenSpacePanning=false;this.keyPanSpeed=7;this.autoRotate=false;this.autoRotateSpeed=2;this.enableKeys=true;this.keys={LEFT:37,UP:38,RIGHT:39,BOTTOM:40};this.mouseButtons={LEFT:THREE.MOUSE.LEFT,MIDDLE:THREE.MOUSE.MIDDLE,RIGHT:THREE.MOUSE.RIGHT};this.target0=this.target.clone();this.position0=this.object.position.clone();this.zoom0=this.object.zoom;this.getPolarAngle=function(){return spherical.phi};this.getAzimuthalAngle=function(){return spherical.theta};this.saveState=function(){scope.target0.copy(scope.target);scope.position0.copy(scope.object.position);scope.zoom0=scope.object.zoom};this.reset=function(){scope.target.copy(scope.target0);scope.object.position.copy(scope.position0);scope.object.zoom=scope.zoom0;scope.object.updateProjectionMatrix();scope.dispatchEvent(changeEvent);scope.update();state=STATE.NONE};this.update=function(){var offset=new THREE.Vector3();var quat=new THREE.Quaternion().setFromUnitVectors(object.up,new THREE.Vector3(0,1,0));var quatInverse=quat.clone().inverse();var lastPosition=new THREE.Vector3();var lastQuaternion=new THREE.Quaternion();return function update(){var position=scope.object.position;offset.copy(position).sub(scope.target);offset.applyQuaternion(quat);spherical.setFromVector3(offset);if(scope.autoRotate&&state===STATE.NONE){rotateLeft(getAutoRotationAngle())}spherical.theta+=sphericalDelta.theta;spherical.phi+=sphericalDelta.phi;spherical.theta=Math.max(scope.minAzimuthAngle,Math.min(scope.maxAzimuthAngle,spherical.theta));
        spherical.phi=Math.max(scope.minPolarAngle,Math.min(scope.maxPolarAngle,spherical.phi));spherical.makeSafe();spherical.radius*=scale;spherical.radius=Math.max(scope.minDistance,Math.min(scope.maxDistance,spherical.radius));scope.target.add(panOffset);offset.setFromSpherical(spherical);offset.applyQuaternion(quatInverse);position.copy(scope.target).add(offset);scope.object.lookAt(scope.target);if(scope.enableDamping===true){sphericalDelta.theta*=(1-scope.dampingFactor);sphericalDelta.phi*=(1-scope.dampingFactor);panOffset.multiplyScalar(1-scope.dampingFactor)}else{sphericalDelta.set(0,0,0);panOffset.set(0,0,0)}scale=1;if(zoomChanged||lastPosition.distanceToSquared(scope.object.position)>EPS||8*(1-lastQuaternion.dot(scope.object.quaternion))>EPS){scope.dispatchEvent(changeEvent);lastPosition.copy(scope.object.position);lastQuaternion.copy(scope.object.quaternion);zoomChanged=false;return true}return false}}();this.dispose=function(){scope.domElement.removeEventListener("contextmenu",onContextMenu,false);scope.domElement.removeEventListener("mousedown",onMouseDown,false);scope.domElement.removeEventListener("wheel",onMouseWheel,false);scope.domElement.removeEventListener("touchstart",onTouchStart,false);scope.domElement.removeEventListener("touchend",onTouchEnd,false);scope.domElement.removeEventListener("touchmove",onTouchMove,false);document.removeEventListener("mousemove",onMouseMove,false);document.removeEventListener("mouseup",onMouseUp,false);window.removeEventListener("keydown",onKeyDown,false)};var scope=this;var changeEvent={type:"change"};var startEvent={type:"start"};var endEvent={type:"end"};var STATE={NONE:-1,ROTATE:0,DOLLY:1,PAN:2,TOUCH_ROTATE:3,TOUCH_DOLLY_PAN:4};var state=STATE.NONE;var EPS=0.000001;var spherical=new THREE.Spherical();var sphericalDelta=new THREE.Spherical();var scale=1;var panOffset=new THREE.Vector3();var zoomChanged=false;var rotateStart=new THREE.Vector2();var rotateEnd=new THREE.Vector2();var rotateDelta=new THREE.Vector2();var panStart=new THREE.Vector2();
        var panEnd=new THREE.Vector2();var panDelta=new THREE.Vector2();var dollyStart=new THREE.Vector2();var dollyEnd=new THREE.Vector2();var dollyDelta=new THREE.Vector2();function getAutoRotationAngle(){return 2*Math.PI/60/60*scope.autoRotateSpeed}function getZoomScale(){return Math.pow(0.95,scope.zoomSpeed)}function rotateLeft(angle){sphericalDelta.theta-=angle}function rotateUp(angle){sphericalDelta.phi-=angle}var panLeft=function(){var v=new THREE.Vector3();return function panLeft(distance,objectMatrix){v.setFromMatrixColumn(objectMatrix,0);v.multiplyScalar(-distance);panOffset.add(v)}}();var panUp=function(){var v=new THREE.Vector3();return function panUp(distance,objectMatrix){if(scope.screenSpacePanning===true){v.setFromMatrixColumn(objectMatrix,1)}else{v.setFromMatrixColumn(objectMatrix,0);v.crossVectors(scope.object.up,v)}v.multiplyScalar(distance);panOffset.add(v)}}();var pan=function(){var offset=new THREE.Vector3();return function pan(deltaX,deltaY){var element=scope.domElement===document?scope.domElement.body:scope.domElement;if(scope.object.isPerspectiveCamera){var position=scope.object.position;offset.copy(position).sub(scope.target);var targetDistance=offset.length();targetDistance*=Math.tan((scope.object.fov/2)*Math.PI/180);panLeft(2*deltaX*targetDistance/element.clientHeight,scope.object.matrix);panUp(2*deltaY*targetDistance/element.clientHeight,scope.object.matrix)}else{if(scope.object.isOrthographicCamera){panLeft(deltaX*(scope.object.right-scope.object.left)/scope.object.zoom/element.clientWidth,scope.object.matrix);panUp(deltaY*(scope.object.top-scope.object.bottom)/scope.object.zoom/element.clientHeight,scope.object.matrix)}else{console.warn("WARNING: OrbitControls.js encountered an unknown camera type - pan disabled.");scope.enablePan=false}}}}();function dollyIn(dollyScale){if(scope.object.isPerspectiveCamera){scale/=dollyScale}else{if(scope.object.isOrthographicCamera){scope.object.zoom=Math.max(scope.minZoom,Math.min(scope.maxZoom,scope.object.zoom*dollyScale));
            scope.object.updateProjectionMatrix();zoomChanged=true}else{console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.");scope.enableZoom=false}}}function dollyOut(dollyScale){if(scope.object.isPerspectiveCamera){scale*=dollyScale}else{if(scope.object.isOrthographicCamera){scope.object.zoom=Math.max(scope.minZoom,Math.min(scope.maxZoom,scope.object.zoom/dollyScale));scope.object.updateProjectionMatrix();zoomChanged=true}else{console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.");scope.enableZoom=false}}}function handleMouseDownRotate(event){rotateStart.set(event.clientX,event.clientY)}function handleMouseDownDolly(event){dollyStart.set(event.clientX,event.clientY)}function handleMouseDownPan(event){panStart.set(event.clientX,event.clientY)}function handleMouseMoveRotate(event){rotateEnd.set(event.clientX,event.clientY);rotateDelta.subVectors(rotateEnd,rotateStart).multiplyScalar(scope.rotateSpeed);var element=scope.domElement===document?scope.domElement.body:scope.domElement;rotateLeft(2*Math.PI*rotateDelta.x/element.clientHeight);rotateUp(2*Math.PI*rotateDelta.y/element.clientHeight);rotateStart.copy(rotateEnd);scope.update()}function handleMouseMoveDolly(event){dollyEnd.set(event.clientX,event.clientY);dollyDelta.subVectors(dollyEnd,dollyStart);if(dollyDelta.y>0){dollyIn(getZoomScale())}else{if(dollyDelta.y<0){dollyOut(getZoomScale())}}dollyStart.copy(dollyEnd);scope.update()}function handleMouseMovePan(event){panEnd.set(event.clientX,event.clientY);panDelta.subVectors(panEnd,panStart).multiplyScalar(scope.panSpeed);pan(panDelta.x,panDelta.y);panStart.copy(panEnd);scope.update()}function handleMouseUp(event){}function handleMouseWheel(event){if(event.deltaY<0){dollyOut(getZoomScale())}else{if(event.deltaY>0){dollyIn(getZoomScale())}}scope.update()}function handleKeyDown(event){switch(event.keyCode){case scope.keys.UP:pan(0,scope.keyPanSpeed);scope.update();break;case scope.keys.BOTTOM:pan(0,-scope.keyPanSpeed);
            scope.update();break;case scope.keys.LEFT:pan(scope.keyPanSpeed,0);scope.update();break;case scope.keys.RIGHT:pan(-scope.keyPanSpeed,0);scope.update();break}}function handleTouchStartRotate(event){rotateStart.set(event.touches[0].pageX,event.touches[0].pageY)}function handleTouchStartDollyPan(event){if(scope.enableZoom){var dx=event.touches[0].pageX-event.touches[1].pageX;var dy=event.touches[0].pageY-event.touches[1].pageY;var distance=Math.sqrt(dx*dx+dy*dy);dollyStart.set(0,distance)}if(scope.enablePan){var x=0.5*(event.touches[0].pageX+event.touches[1].pageX);var y=0.5*(event.touches[0].pageY+event.touches[1].pageY);panStart.set(x,y)}}function handleTouchMoveRotate(event){rotateEnd.set(event.touches[0].pageX,event.touches[0].pageY);rotateDelta.subVectors(rotateEnd,rotateStart).multiplyScalar(scope.rotateSpeed);var element=scope.domElement===document?scope.domElement.body:scope.domElement;rotateLeft(2*Math.PI*rotateDelta.x/element.clientHeight);rotateUp(2*Math.PI*rotateDelta.y/element.clientHeight);rotateStart.copy(rotateEnd);scope.update()}function handleTouchMoveDollyPan(event){if(scope.enableZoom){var dx=event.touches[0].pageX-event.touches[1].pageX;var dy=event.touches[0].pageY-event.touches[1].pageY;var distance=Math.sqrt(dx*dx+dy*dy);dollyEnd.set(0,distance);dollyDelta.set(0,Math.pow(dollyEnd.y/dollyStart.y,scope.zoomSpeed));dollyIn(dollyDelta.y);dollyStart.copy(dollyEnd)}if(scope.enablePan){var x=0.5*(event.touches[0].pageX+event.touches[1].pageX);var y=0.5*(event.touches[0].pageY+event.touches[1].pageY);panEnd.set(x,y);panDelta.subVectors(panEnd,panStart).multiplyScalar(scope.panSpeed);pan(panDelta.x,panDelta.y);panStart.copy(panEnd)}scope.update()}function handleTouchEnd(event){}function onMouseDown(event){if(scope.enabled===false){return}event.preventDefault();switch(event.button){case scope.mouseButtons.LEFT:if(event.ctrlKey||event.metaKey){if(scope.enablePan===false){return}handleMouseDownPan(event);state=STATE.PAN}else{if(scope.enableRotate===false){return
        }handleMouseDownRotate(event);state=STATE.ROTATE}break;case scope.mouseButtons.MIDDLE:if(scope.enableZoom===false){return}handleMouseDownDolly(event);state=STATE.DOLLY;break;case scope.mouseButtons.RIGHT:if(scope.enablePan===false){return}handleMouseDownPan(event);state=STATE.PAN;break}if(state!==STATE.NONE){document.addEventListener("mousemove",onMouseMove,false);document.addEventListener("mouseup",onMouseUp,false);scope.dispatchEvent(startEvent)}}function onMouseMove(event){if(scope.enabled===false){return}event.preventDefault();switch(state){case STATE.ROTATE:if(scope.enableRotate===false){return}handleMouseMoveRotate(event);break;case STATE.DOLLY:if(scope.enableZoom===false){return}handleMouseMoveDolly(event);break;case STATE.PAN:if(scope.enablePan===false){return}handleMouseMovePan(event);break}}function onMouseUp(event){if(scope.enabled===false){return}handleMouseUp(event);document.removeEventListener("mousemove",onMouseMove,false);document.removeEventListener("mouseup",onMouseUp,false);scope.dispatchEvent(endEvent);state=STATE.NONE}function onMouseWheel(event){if(scope.enabled===false||scope.enableZoom===false||(state!==STATE.NONE&&state!==STATE.ROTATE)){return}event.preventDefault();event.stopPropagation();scope.dispatchEvent(startEvent);handleMouseWheel(event);scope.dispatchEvent(endEvent)}function onKeyDown(event){if(scope.enabled===false||scope.enableKeys===false||scope.enablePan===false){return}handleKeyDown(event)}function onTouchStart(event){if(scope.enabled===false){return}event.preventDefault();switch(event.touches.length){case 1:if(scope.enableRotate===false){return}handleTouchStartRotate(event);state=STATE.TOUCH_ROTATE;break;case 2:if(scope.enableZoom===false&&scope.enablePan===false){return}handleTouchStartDollyPan(event);state=STATE.TOUCH_DOLLY_PAN;break;default:state=STATE.NONE}if(state!==STATE.NONE){scope.dispatchEvent(startEvent)}}function onTouchMove(event){if(scope.enabled===false){return}event.preventDefault();event.stopPropagation();switch(event.touches.length){case 1:if(scope.enableRotate===false){return
        }if(state!==STATE.TOUCH_ROTATE){return}handleTouchMoveRotate(event);break;case 2:if(scope.enableZoom===false&&scope.enablePan===false){return}if(state!==STATE.TOUCH_DOLLY_PAN){return}handleTouchMoveDollyPan(event);break;default:state=STATE.NONE}}function onTouchEnd(event){if(scope.enabled===false){return}handleTouchEnd(event);scope.dispatchEvent(endEvent);state=STATE.NONE}function onContextMenu(event){if(scope.enabled===false){return}event.preventDefault()}scope.domElement.addEventListener("contextmenu",onContextMenu,false);scope.domElement.addEventListener("mousedown",onMouseDown,false);scope.domElement.addEventListener("wheel",onMouseWheel,false);scope.domElement.addEventListener("touchstart",onTouchStart,false);scope.domElement.addEventListener("touchend",onTouchEnd,false);scope.domElement.addEventListener("touchmove",onTouchMove,false);window.addEventListener("keydown",onKeyDown,false);this.update()};THREE.OrbitControls.prototype=Object.create(THREE.EventDispatcher.prototype);THREE.OrbitControls.prototype.constructor=THREE.OrbitControls;Object.defineProperties(THREE.OrbitControls.prototype,{center:{get:function(){console.warn("THREE.OrbitControls: .center has been renamed to .target");return this.target}},noZoom:{get:function(){console.warn("THREE.OrbitControls: .noZoom has been deprecated. Use .enableZoom instead.");return !this.enableZoom},set:function(value){console.warn("THREE.OrbitControls: .noZoom has been deprecated. Use .enableZoom instead.");this.enableZoom=!value}},noRotate:{get:function(){console.warn("THREE.OrbitControls: .noRotate has been deprecated. Use .enableRotate instead.");return !this.enableRotate},set:function(value){console.warn("THREE.OrbitControls: .noRotate has been deprecated. Use .enableRotate instead.");this.enableRotate=!value}},noPan:{get:function(){console.warn("THREE.OrbitControls: .noPan has been deprecated. Use .enablePan instead.");return !this.enablePan},set:function(value){console.warn("THREE.OrbitControls: .noPan has been deprecated. Use .enablePan instead.");
        this.enablePan=!value}},noKeys:{get:function(){console.warn("THREE.OrbitControls: .noKeys has been deprecated. Use .enableKeys instead.");return !this.enableKeys},set:function(value){console.warn("THREE.OrbitControls: .noKeys has been deprecated. Use .enableKeys instead.");this.enableKeys=!value}},staticMoving:{get:function(){console.warn("THREE.OrbitControls: .staticMoving has been deprecated. Use .enableDamping instead.");return !this.enableDamping},set:function(value){console.warn("THREE.OrbitControls: .staticMoving has been deprecated. Use .enableDamping instead.");this.enableDamping=!value}},dynamicDampingFactor:{get:function(){console.warn("THREE.OrbitControls: .dynamicDampingFactor has been renamed. Use .dampingFactor instead.");return this.dampingFactor},set:function(value){console.warn("THREE.OrbitControls: .dynamicDampingFactor has been renamed. Use .dampingFactor instead.");this.dampingFactor=value}}});

}

function _initThreeJs(){
    /** @license zlib.js 2012 - imaya [ https://github.com/imaya/zlib.js ] The MIT License */(function() {'use strict';var l=void 0,aa=this;function r(c,d){var a=c.split("."),b=aa;!(a[0]in b)&&b.execScript&&b.execScript("var "+a[0]);for(var e;a.length&&(e=a.shift());)!a.length&&d!==l?b[e]=d:b=b[e]?b[e]:b[e]={}};var t="undefined"!==typeof Uint8Array&&"undefined"!==typeof Uint16Array&&"undefined"!==typeof Uint32Array&&"undefined"!==typeof DataView;function v(c){var d=c.length,a=0,b=Number.POSITIVE_INFINITY,e,f,g,h,k,m,n,p,s,x;for(p=0;p<d;++p)c[p]>a&&(a=c[p]),c[p]<b&&(b=c[p]);e=1<<a;f=new (t?Uint32Array:Array)(e);g=1;h=0;for(k=2;g<=a;){for(p=0;p<d;++p)if(c[p]===g){m=0;n=h;for(s=0;s<g;++s)m=m<<1|n&1,n>>=1;x=g<<16|p;for(s=m;s<e;s+=k)f[s]=x;++h}++g;h<<=1;k<<=1}return[f,a,b]};function w(c,d){this.g=[];this.h=32768;this.d=this.f=this.a=this.l=0;this.input=t?new Uint8Array(c):c;this.m=!1;this.i=y;this.r=!1;if(d||!(d={}))d.index&&(this.a=d.index),d.bufferSize&&(this.h=d.bufferSize),d.bufferType&&(this.i=d.bufferType),d.resize&&(this.r=d.resize);switch(this.i){case A:this.b=32768;this.c=new (t?Uint8Array:Array)(32768+this.h+258);break;case y:this.b=0;this.c=new (t?Uint8Array:Array)(this.h);this.e=this.z;this.n=this.v;this.j=this.w;break;default:throw Error("invalid inflate mode");
    }}var A=0,y=1,B={t:A,s:y};
        w.prototype.k=function(){for(;!this.m;){var c=C(this,3);c&1&&(this.m=!0);c>>>=1;switch(c){case 0:var d=this.input,a=this.a,b=this.c,e=this.b,f=d.length,g=l,h=l,k=b.length,m=l;this.d=this.f=0;if(a+1>=f)throw Error("invalid uncompressed block header: LEN");g=d[a++]|d[a++]<<8;if(a+1>=f)throw Error("invalid uncompressed block header: NLEN");h=d[a++]|d[a++]<<8;if(g===~h)throw Error("invalid uncompressed block header: length verify");if(a+g>d.length)throw Error("input buffer is broken");switch(this.i){case A:for(;e+
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         g>b.length;){m=k-e;g-=m;if(t)b.set(d.subarray(a,a+m),e),e+=m,a+=m;else for(;m--;)b[e++]=d[a++];this.b=e;b=this.e();e=this.b}break;case y:for(;e+g>b.length;)b=this.e({p:2});break;default:throw Error("invalid inflate mode");}if(t)b.set(d.subarray(a,a+g),e),e+=g,a+=g;else for(;g--;)b[e++]=d[a++];this.a=a;this.b=e;this.c=b;break;case 1:this.j(ba,ca);break;case 2:for(var n=C(this,5)+257,p=C(this,5)+1,s=C(this,4)+4,x=new (t?Uint8Array:Array)(D.length),S=l,T=l,U=l,u=l,M=l,F=l,z=l,q=l,V=l,q=0;q<s;++q)x[D[q]]=
            C(this,3);if(!t){q=s;for(s=x.length;q<s;++q)x[D[q]]=0}S=v(x);u=new (t?Uint8Array:Array)(n+p);q=0;for(V=n+p;q<V;)switch(M=E(this,S),M){case 16:for(z=3+C(this,2);z--;)u[q++]=F;break;case 17:for(z=3+C(this,3);z--;)u[q++]=0;F=0;break;case 18:for(z=11+C(this,7);z--;)u[q++]=0;F=0;break;default:F=u[q++]=M}T=t?v(u.subarray(0,n)):v(u.slice(0,n));U=t?v(u.subarray(n)):v(u.slice(n));this.j(T,U);break;default:throw Error("unknown BTYPE: "+c);}}return this.n()};
        var G=[16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15],D=t?new Uint16Array(G):G,H=[3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258,258,258],I=t?new Uint16Array(H):H,J=[0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0,0,0],K=t?new Uint8Array(J):J,L=[1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577],da=t?new Uint16Array(L):L,ea=[0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,
            13,13],N=t?new Uint8Array(ea):ea,O=new (t?Uint8Array:Array)(288),P,fa;P=0;for(fa=O.length;P<fa;++P)O[P]=143>=P?8:255>=P?9:279>=P?7:8;var ba=v(O),Q=new (t?Uint8Array:Array)(30),R,ga;R=0;for(ga=Q.length;R<ga;++R)Q[R]=5;var ca=v(Q);function C(c,d){for(var a=c.f,b=c.d,e=c.input,f=c.a,g=e.length,h;b<d;){if(f>=g)throw Error("input buffer is broken");a|=e[f++]<<b;b+=8}h=a&(1<<d)-1;c.f=a>>>d;c.d=b-d;c.a=f;return h}
        function E(c,d){for(var a=c.f,b=c.d,e=c.input,f=c.a,g=e.length,h=d[0],k=d[1],m,n;b<k&&!(f>=g);)a|=e[f++]<<b,b+=8;m=h[a&(1<<k)-1];n=m>>>16;if(n>b)throw Error("invalid code length: "+n);c.f=a>>n;c.d=b-n;c.a=f;return m&65535}
        w.prototype.j=function(c,d){var a=this.c,b=this.b;this.o=c;for(var e=a.length-258,f,g,h,k;256!==(f=E(this,c));)if(256>f)b>=e&&(this.b=b,a=this.e(),b=this.b),a[b++]=f;else{g=f-257;k=I[g];0<K[g]&&(k+=C(this,K[g]));f=E(this,d);h=da[f];0<N[f]&&(h+=C(this,N[f]));b>=e&&(this.b=b,a=this.e(),b=this.b);for(;k--;)a[b]=a[b++-h]}for(;8<=this.d;)this.d-=8,this.a--;this.b=b};
        w.prototype.w=function(c,d){var a=this.c,b=this.b;this.o=c;for(var e=a.length,f,g,h,k;256!==(f=E(this,c));)if(256>f)b>=e&&(a=this.e(),e=a.length),a[b++]=f;else{g=f-257;k=I[g];0<K[g]&&(k+=C(this,K[g]));f=E(this,d);h=da[f];0<N[f]&&(h+=C(this,N[f]));b+k>e&&(a=this.e(),e=a.length);for(;k--;)a[b]=a[b++-h]}for(;8<=this.d;)this.d-=8,this.a--;this.b=b};
        w.prototype.e=function(){var c=new (t?Uint8Array:Array)(this.b-32768),d=this.b-32768,a,b,e=this.c;if(t)c.set(e.subarray(32768,c.length));else{a=0;for(b=c.length;a<b;++a)c[a]=e[a+32768]}this.g.push(c);this.l+=c.length;if(t)e.set(e.subarray(d,d+32768));else for(a=0;32768>a;++a)e[a]=e[d+a];this.b=32768;return e};
        w.prototype.z=function(c){var d,a=this.input.length/this.a+1|0,b,e,f,g=this.input,h=this.c;c&&("number"===typeof c.p&&(a=c.p),"number"===typeof c.u&&(a+=c.u));2>a?(b=(g.length-this.a)/this.o[2],f=258*(b/2)|0,e=f<h.length?h.length+f:h.length<<1):e=h.length*a;t?(d=new Uint8Array(e),d.set(h)):d=h;return this.c=d};
        w.prototype.n=function(){var c=0,d=this.c,a=this.g,b,e=new (t?Uint8Array:Array)(this.l+(this.b-32768)),f,g,h,k;if(0===a.length)return t?this.c.subarray(32768,this.b):this.c.slice(32768,this.b);f=0;for(g=a.length;f<g;++f){b=a[f];h=0;for(k=b.length;h<k;++h)e[c++]=b[h]}f=32768;for(g=this.b;f<g;++f)e[c++]=d[f];this.g=[];return this.buffer=e};
        w.prototype.v=function(){var c,d=this.b;t?this.r?(c=new Uint8Array(d),c.set(this.c.subarray(0,d))):c=this.c.subarray(0,d):(this.c.length>d&&(this.c.length=d),c=this.c);return this.buffer=c};function W(c,d){var a,b;this.input=c;this.a=0;if(d||!(d={}))d.index&&(this.a=d.index),d.verify&&(this.A=d.verify);a=c[this.a++];b=c[this.a++];switch(a&15){case ha:this.method=ha;break;default:throw Error("unsupported compression method");}if(0!==((a<<8)+b)%31)throw Error("invalid fcheck flag:"+((a<<8)+b)%31);if(b&32)throw Error("fdict flag is not supported");this.q=new w(c,{index:this.a,bufferSize:d.bufferSize,bufferType:d.bufferType,resize:d.resize})}
        W.prototype.k=function(){var c=this.input,d,a;d=this.q.k();this.a=this.q.a;if(this.A){a=(c[this.a++]<<24|c[this.a++]<<16|c[this.a++]<<8|c[this.a++])>>>0;var b=d;if("string"===typeof b){var e=b.split(""),f,g;f=0;for(g=e.length;f<g;f++)e[f]=(e[f].charCodeAt(0)&255)>>>0;b=e}for(var h=1,k=0,m=b.length,n,p=0;0<m;){n=1024<m?1024:m;m-=n;do h+=b[p++],k+=h;while(--n);h%=65521;k%=65521}if(a!==(k<<16|h)>>>0)throw Error("invalid adler-32 checksum");}return d};var ha=8;r("Zlib.Inflate",W);r("Zlib.Inflate.prototype.decompress",W.prototype.k);var X={ADAPTIVE:B.s,BLOCK:B.t},Y,Z,$,ia;if(Object.keys)Y=Object.keys(X);else for(Z in Y=[],$=0,X)Y[$++]=Z;$=0;for(ia=Y.length;$<ia;++$)Z=Y[$],r("Zlib.Inflate.BufferType."+Z,X[Z]);}).call(this);

    THREE.FBXLoader=(function(){var fbxTree;var connections;var sceneGraph;function FBXLoader(manager){this.manager=(manager!==undefined)?manager:THREE.DefaultLoadingManager}FBXLoader.prototype={constructor:FBXLoader,crossOrigin:"anonymous",load:function(url,onLoad,onProgress,onError){var self=this;var path=(self.path===undefined)?THREE.LoaderUtils.extractUrlBase(url):self.path;var loader=new THREE.FileLoader(this.manager);loader.setResponseType("arraybuffer");loader.load(url,function(buffer){try{onLoad(self.parse(buffer,path))}catch(error){setTimeout(function(){if(onError){onError(error)}self.manager.itemError(url)},0)}},onProgress,onError)},setPath:function(value){this.path=value;return this},setResourcePath:function(value){this.resourcePath=value;return this},setCrossOrigin:function(value){this.crossOrigin=value;return this},parse:function(FBXBuffer,path){if(isFbxFormatBinary(FBXBuffer)){fbxTree=new BinaryParser().parse(FBXBuffer)}else{var FBXText=convertArrayBufferToString(FBXBuffer);if(!isFbxFormatASCII(FBXText)){throw new Error("THREE.FBXLoader: Unknown format.")}if(getFbxVersion(FBXText)<7000){throw new Error("THREE.FBXLoader: FBX version not supported, FileVersion: "+getFbxVersion(FBXText))}fbxTree=new TextParser().parse(FBXText)}var textureLoader=new THREE.TextureLoader(this.manager).setPath(this.resourcePath||path).setCrossOrigin(this.crossOrigin);return new FBXTreeParser(textureLoader).parse(fbxTree)}};function FBXTreeParser(textureLoader){this.textureLoader=textureLoader}FBXTreeParser.prototype={constructor:FBXTreeParser,parse:function(){connections=this.parseConnections();var images=this.parseImages();var textures=this.parseTextures(images);var materials=this.parseMaterials(textures);var deformers=this.parseDeformers();var geometryMap=new GeometryParser().parse(deformers);this.parseScene(deformers,geometryMap,materials);return sceneGraph},parseConnections:function(){var connectionMap=new Map();if("Connections" in fbxTree){var rawConnections=fbxTree.Connections.connections;
        rawConnections.forEach(function(rawConnection){var fromID=rawConnection[0];var toID=rawConnection[1];var relationship=rawConnection[2];if(!connectionMap.has(fromID)){connectionMap.set(fromID,{parents:[],children:[]})}var parentRelationship={ID:toID,relationship:relationship};connectionMap.get(fromID).parents.push(parentRelationship);if(!connectionMap.has(toID)){connectionMap.set(toID,{parents:[],children:[]})}var childRelationship={ID:fromID,relationship:relationship};connectionMap.get(toID).children.push(childRelationship)})}return connectionMap},parseImages:function(){var images={};var blobs={};if("Video" in fbxTree.Objects){var videoNodes=fbxTree.Objects.Video;for(var nodeID in videoNodes){var videoNode=videoNodes[nodeID];var id=parseInt(nodeID);images[id]=videoNode.RelativeFilename||videoNode.Filename;if("Content" in videoNode){var arrayBufferContent=(videoNode.Content instanceof ArrayBuffer)&&(videoNode.Content.byteLength>0);var base64Content=(typeof videoNode.Content==="string")&&(videoNode.Content!=="");if(arrayBufferContent||base64Content){var image=this.parseImage(videoNodes[nodeID]);blobs[videoNode.RelativeFilename||videoNode.Filename]=image}}}}for(var id in images){var filename=images[id];if(blobs[filename]!==undefined){images[id]=blobs[filename]}else{images[id]=images[id].split("\\").pop()}}return images},parseImage:function(videoNode){var content=videoNode.Content;var fileName=videoNode.RelativeFilename||videoNode.Filename;var extension=fileName.slice(fileName.lastIndexOf(".")+1).toLowerCase();var type;switch(extension){case"bmp":type="image/bmp";break;case"jpg":case"jpeg":type="image/jpeg";break;case"png":type="image/png";break;case"tif":type="image/tiff";break;case"tga":if(typeof THREE.TGALoader!=="function"){console.warn("FBXLoader: THREE.TGALoader is required to load TGA textures");return}else{if(THREE.Loader.Handlers.get(".tga")===null){var tgaLoader=new THREE.TGALoader();tgaLoader.setPath(this.textureLoader.path);THREE.Loader.Handlers.add(/\.tga$/i,tgaLoader)
    }type="image/tga";break}default:console.warn('FBXLoader: Image type "'+extension+'" is not supported.');return}if(typeof content==="string"){return"data:"+type+";base64,"+content}else{var array=new Uint8Array(content);return window.URL.createObjectURL(new Blob([array],{type:type}))}},parseTextures:function(images){var textureMap=new Map();if("Texture" in fbxTree.Objects){var textureNodes=fbxTree.Objects.Texture;for(var nodeID in textureNodes){var texture=this.parseTexture(textureNodes[nodeID],images);textureMap.set(parseInt(nodeID),texture)}}return textureMap},parseTexture:function(textureNode,images){var texture=this.loadTexture(textureNode,images);texture.ID=textureNode.id;texture.name=textureNode.attrName;var wrapModeU=textureNode.WrapModeU;var wrapModeV=textureNode.WrapModeV;var valueU=wrapModeU!==undefined?wrapModeU.value:0;var valueV=wrapModeV!==undefined?wrapModeV.value:0;texture.wrapS=valueU===0?THREE.RepeatWrapping:THREE.ClampToEdgeWrapping;texture.wrapT=valueV===0?THREE.RepeatWrapping:THREE.ClampToEdgeWrapping;if("Scaling" in textureNode){var values=textureNode.Scaling.value;texture.repeat.x=values[0];texture.repeat.y=values[1]}return texture},loadTexture:function(textureNode,images){var fileName;var currentPath=this.textureLoader.path;var children=connections.get(textureNode.id).children;if(children!==undefined&&children.length>0&&images[children[0].ID]!==undefined){fileName=images[children[0].ID];if(fileName.indexOf("blob:")===0||fileName.indexOf("data:")===0){this.textureLoader.setPath(undefined)}}var texture;var extension=textureNode.FileName.slice(-3).toLowerCase();if(extension==="tga"){var loader=THREE.Loader.Handlers.get(".tga");if(loader===null){console.warn("FBXLoader: TGALoader not found, creating empty placeholder texture for",fileName);texture=new THREE.Texture()}else{texture=loader.load(fileName)}}else{if(extension==="psd"){console.warn("FBXLoader: PSD textures are not supported, creating empty placeholder texture for",fileName);texture=new THREE.Texture()
    }else{texture=this.textureLoader.load(fileName)}}this.textureLoader.setPath(currentPath);return texture},parseMaterials:function(textureMap){var materialMap=new Map();if("Material" in fbxTree.Objects){var materialNodes=fbxTree.Objects.Material;for(var nodeID in materialNodes){var material=this.parseMaterial(materialNodes[nodeID],textureMap);if(material!==null){materialMap.set(parseInt(nodeID),material)}}}return materialMap},parseMaterial:function(materialNode,textureMap){var ID=materialNode.id;var name=materialNode.attrName;var type=materialNode.ShadingModel;if(typeof type==="object"){type=type.value}if(!connections.has(ID)){return null}var parameters=this.parseParameters(materialNode,textureMap,ID);var material;switch(type.toLowerCase()){case"phong":material=new THREE.MeshPhongMaterial();break;case"lambert":material=new THREE.MeshLambertMaterial();break;default:console.warn('THREE.FBXLoader: unknown material type "%s". Defaulting to MeshPhongMaterial.',type);material=new THREE.MeshPhongMaterial({color:3342591});break}material.setValues(parameters);material.name=name;return material},parseParameters:function(materialNode,textureMap,ID){var parameters={};if(materialNode.BumpFactor){parameters.bumpScale=materialNode.BumpFactor.value}if(materialNode.Diffuse){parameters.color=new THREE.Color().fromArray(materialNode.Diffuse.value)}else{if(materialNode.DiffuseColor&&materialNode.DiffuseColor.type==="Color"){parameters.color=new THREE.Color().fromArray(materialNode.DiffuseColor.value)}}if(materialNode.DisplacementFactor){parameters.displacementScale=materialNode.DisplacementFactor.value}if(materialNode.Emissive){parameters.emissive=new THREE.Color().fromArray(materialNode.Emissive.value)}else{if(materialNode.EmissiveColor&&materialNode.EmissiveColor.type==="Color"){parameters.emissive=new THREE.Color().fromArray(materialNode.EmissiveColor.value)}}if(materialNode.EmissiveFactor){parameters.emissiveIntensity=parseFloat(materialNode.EmissiveFactor.value)}if(materialNode.Opacity){parameters.opacity=parseFloat(materialNode.Opacity.value)
    }if(parameters.opacity<1){parameters.transparent=true}if(materialNode.ReflectionFactor){parameters.reflectivity=materialNode.ReflectionFactor.value}if(materialNode.Shininess){parameters.shininess=materialNode.Shininess.value}if(materialNode.Specular){parameters.specular=new THREE.Color().fromArray(materialNode.Specular.value)}else{if(materialNode.SpecularColor&&materialNode.SpecularColor.type==="Color"){parameters.specular=new THREE.Color().fromArray(materialNode.SpecularColor.value)}}var self=this;connections.get(ID).children.forEach(function(child){var type=child.relationship;switch(type){case"Bump":parameters.bumpMap=self.getTexture(textureMap,child.ID);break;case"DiffuseColor":parameters.map=self.getTexture(textureMap,child.ID);break;case"DisplacementColor":parameters.displacementMap=self.getTexture(textureMap,child.ID);break;case"EmissiveColor":parameters.emissiveMap=self.getTexture(textureMap,child.ID);break;case"NormalMap":parameters.normalMap=self.getTexture(textureMap,child.ID);break;case"ReflectionColor":parameters.envMap=self.getTexture(textureMap,child.ID);parameters.envMap.mapping=THREE.EquirectangularReflectionMapping;break;case"SpecularColor":parameters.specularMap=self.getTexture(textureMap,child.ID);break;case"TransparentColor":parameters.alphaMap=self.getTexture(textureMap,child.ID);parameters.transparent=true;break;case"AmbientColor":case"ShininessExponent":case"SpecularFactor":case"VectorDisplacementColor":default:console.warn("THREE.FBXLoader: %s map is not supported in three.js, skipping texture.",type);break}});return parameters},getTexture:function(textureMap,id){if("LayeredTexture" in fbxTree.Objects&&id in fbxTree.Objects.LayeredTexture){console.warn("THREE.FBXLoader: layered textures are not supported in three.js. Discarding all but first layer.");id=connections.get(id).children[0].ID}return textureMap.get(id)},parseDeformers:function(){var skeletons={};var morphTargets={};if("Deformer" in fbxTree.Objects){var DeformerNodes=fbxTree.Objects.Deformer;
        for(var nodeID in DeformerNodes){var deformerNode=DeformerNodes[nodeID];var relationships=connections.get(parseInt(nodeID));if(deformerNode.attrType==="Skin"){var skeleton=this.parseSkeleton(relationships,DeformerNodes);skeleton.ID=nodeID;if(relationships.parents.length>1){console.warn("THREE.FBXLoader: skeleton attached to more than one geometry is not supported.")}skeleton.geometryID=relationships.parents[0].ID;skeletons[nodeID]=skeleton}else{if(deformerNode.attrType==="BlendShape"){var morphTarget={id:nodeID,};morphTarget.rawTargets=this.parseMorphTargets(relationships,DeformerNodes);morphTarget.id=nodeID;if(relationships.parents.length>1){console.warn("THREE.FBXLoader: morph target attached to more than one geometry is not supported.")}morphTargets[nodeID]=morphTarget}}}}return{skeletons:skeletons,morphTargets:morphTargets,}},parseSkeleton:function(relationships,deformerNodes){var rawBones=[];relationships.children.forEach(function(child){var boneNode=deformerNodes[child.ID];if(boneNode.attrType!=="Cluster"){return}var rawBone={ID:child.ID,indices:[],weights:[],transformLink:new THREE.Matrix4().fromArray(boneNode.TransformLink.a),};if("Indexes" in boneNode){rawBone.indices=boneNode.Indexes.a;rawBone.weights=boneNode.Weights.a}rawBones.push(rawBone)});return{rawBones:rawBones,bones:[]}},parseMorphTargets:function(relationships,deformerNodes){var rawMorphTargets=[];for(var i=0;i<relationships.children.length;i++){var child=relationships.children[i];var morphTargetNode=deformerNodes[child.ID];var rawMorphTarget={name:morphTargetNode.attrName,initialWeight:morphTargetNode.DeformPercent,id:morphTargetNode.id,fullWeights:morphTargetNode.FullWeights.a};if(morphTargetNode.attrType!=="BlendShapeChannel"){return}rawMorphTarget.geoID=connections.get(parseInt(child.ID)).children.filter(function(child){return child.relationship===undefined})[0].ID;rawMorphTargets.push(rawMorphTarget)}return rawMorphTargets},parseScene:function(deformers,geometryMap,materialMap){sceneGraph=new THREE.Group();
        var modelMap=this.parseModels(deformers.skeletons,geometryMap,materialMap);var modelNodes=fbxTree.Objects.Model;var self=this;modelMap.forEach(function(model){var modelNode=modelNodes[model.ID];self.setLookAtProperties(model,modelNode);var parentConnections=connections.get(model.ID).parents;parentConnections.forEach(function(connection){var parent=modelMap.get(connection.ID);if(parent!==undefined){parent.add(model)}});if(model.parent===null){sceneGraph.add(model)}});this.bindSkeleton(deformers.skeletons,geometryMap,modelMap);this.createAmbientLight();this.setupMorphMaterials();sceneGraph.traverse(function(node){if(node.userData.transformData){if(node.parent){node.userData.transformData.parentMatrixWorld=node.parent.matrix}var transform=generateTransform(node.userData.transformData);node.applyMatrix(transform)}});var animations=new AnimationParser().parse();if(sceneGraph.children.length===1&&sceneGraph.children[0].isGroup){sceneGraph.children[0].animations=animations;sceneGraph=sceneGraph.children[0]}sceneGraph.animations=animations},parseModels:function(skeletons,geometryMap,materialMap){var modelMap=new Map();var modelNodes=fbxTree.Objects.Model;for(var nodeID in modelNodes){var id=parseInt(nodeID);var node=modelNodes[nodeID];var relationships=connections.get(id);var model=this.buildSkeleton(relationships,skeletons,id,node.attrName);if(!model){switch(node.attrType){case"Camera":model=this.createCamera(relationships);break;case"Light":model=this.createLight(relationships);break;case"Mesh":model=this.createMesh(relationships,geometryMap,materialMap);break;case"NurbsCurve":model=this.createCurve(relationships,geometryMap);break;case"LimbNode":case"Root":model=new THREE.Bone();break;case"Null":default:model=new THREE.Group();break}model.name=THREE.PropertyBinding.sanitizeNodeName(node.attrName);model.ID=id}this.getTransformData(model,node);modelMap.set(id,model)}return modelMap},buildSkeleton:function(relationships,skeletons,id,name){var bone=null;relationships.parents.forEach(function(parent){for(var ID in skeletons){var skeleton=skeletons[ID];
        skeleton.rawBones.forEach(function(rawBone,i){if(rawBone.ID===parent.ID){var subBone=bone;bone=new THREE.Bone();bone.matrixWorld.copy(rawBone.transformLink);bone.name=THREE.PropertyBinding.sanitizeNodeName(name);bone.ID=id;skeleton.bones[i]=bone;if(subBone!==null){bone.add(subBone)}}})}});return bone},createCamera:function(relationships){var model;var cameraAttribute;relationships.children.forEach(function(child){var attr=fbxTree.Objects.NodeAttribute[child.ID];if(attr!==undefined){cameraAttribute=attr}});if(cameraAttribute===undefined){model=new THREE.Object3D()}else{var type=0;if(cameraAttribute.CameraProjectionType!==undefined&&cameraAttribute.CameraProjectionType.value===1){type=1}var nearClippingPlane=1;if(cameraAttribute.NearPlane!==undefined){nearClippingPlane=cameraAttribute.NearPlane.value/1000}var farClippingPlane=1000;if(cameraAttribute.FarPlane!==undefined){farClippingPlane=cameraAttribute.FarPlane.value/1000}var width=window.innerWidth;var height=window.innerHeight;if(cameraAttribute.AspectWidth!==undefined&&cameraAttribute.AspectHeight!==undefined){width=cameraAttribute.AspectWidth.value;height=cameraAttribute.AspectHeight.value}var aspect=width/height;var fov=45;if(cameraAttribute.FieldOfView!==undefined){fov=cameraAttribute.FieldOfView.value}var focalLength=cameraAttribute.FocalLength?cameraAttribute.FocalLength.value:null;switch(type){case 0:model=new THREE.PerspectiveCamera(fov,aspect,nearClippingPlane,farClippingPlane);if(focalLength!==null){model.setFocalLength(focalLength)}break;case 1:model=new THREE.OrthographicCamera(-width/2,width/2,height/2,-height/2,nearClippingPlane,farClippingPlane);break;default:console.warn("THREE.FBXLoader: Unknown camera type "+type+".");model=new THREE.Object3D();break}}return model},createLight:function(relationships){var model;var lightAttribute;relationships.children.forEach(function(child){var attr=fbxTree.Objects.NodeAttribute[child.ID];if(attr!==undefined){lightAttribute=attr}});if(lightAttribute===undefined){model=new THREE.Object3D()
    }else{var type;if(lightAttribute.LightType===undefined){type=0}else{type=lightAttribute.LightType.value}var color=16777215;if(lightAttribute.Color!==undefined){color=new THREE.Color().fromArray(lightAttribute.Color.value)}var intensity=(lightAttribute.Intensity===undefined)?1:lightAttribute.Intensity.value/100;if(lightAttribute.CastLightOnObject!==undefined&&lightAttribute.CastLightOnObject.value===0){intensity=0}var distance=0;if(lightAttribute.FarAttenuationEnd!==undefined){if(lightAttribute.EnableFarAttenuation!==undefined&&lightAttribute.EnableFarAttenuation.value===0){distance=0}else{distance=lightAttribute.FarAttenuationEnd.value}}var decay=1;switch(type){case 0:model=new THREE.PointLight(color,intensity,distance,decay);break;case 1:model=new THREE.DirectionalLight(color,intensity);break;case 2:var angle=Math.PI/3;if(lightAttribute.InnerAngle!==undefined){angle=THREE.Math.degToRad(lightAttribute.InnerAngle.value)}var penumbra=0;if(lightAttribute.OuterAngle!==undefined){penumbra=THREE.Math.degToRad(lightAttribute.OuterAngle.value);penumbra=Math.max(penumbra,1)}model=new THREE.SpotLight(color,intensity,distance,angle,penumbra,decay);break;default:console.warn("THREE.FBXLoader: Unknown light type "+lightAttribute.LightType.value+", defaulting to a THREE.PointLight.");model=new THREE.PointLight(color,intensity);break}if(lightAttribute.CastShadows!==undefined&&lightAttribute.CastShadows.value===1){model.castShadow=true}}return model},createMesh:function(relationships,geometryMap,materialMap){var model;var geometry=null;var material=null;var materials=[];relationships.children.forEach(function(child){if(geometryMap.has(child.ID)){geometry=geometryMap.get(child.ID)}if(materialMap.has(child.ID)){materials.push(materialMap.get(child.ID))}});if(materials.length>1){material=materials}else{if(materials.length>0){material=materials[0]}else{material=new THREE.MeshPhongMaterial({color:13421772});materials.push(material)}}if("color" in geometry.attributes){materials.forEach(function(material){material.vertexColors=THREE.VertexColors
    })}if(geometry.FBX_Deformer){materials.forEach(function(material){material.skinning=true});model=new THREE.SkinnedMesh(geometry,material)}else{model=new THREE.Mesh(geometry,material)}return model},createCurve:function(relationships,geometryMap){var geometry=relationships.children.reduce(function(geo,child){if(geometryMap.has(child.ID)){geo=geometryMap.get(child.ID)}return geo},null);var material=new THREE.LineBasicMaterial({color:3342591,linewidth:1});return new THREE.Line(geometry,material)},getTransformData:function(model,modelNode){var transformData={};if("InheritType" in modelNode){transformData.inheritType=parseInt(modelNode.InheritType.value)}if("RotationOrder" in modelNode){transformData.eulerOrder=getEulerOrder(modelNode.RotationOrder.value)}else{transformData.eulerOrder="ZYX"}if("Lcl_Translation" in modelNode){transformData.translation=modelNode.Lcl_Translation.value}if("PreRotation" in modelNode){transformData.preRotation=modelNode.PreRotation.value}if("Lcl_Rotation" in modelNode){transformData.rotation=modelNode.Lcl_Rotation.value}if("PostRotation" in modelNode){transformData.postRotation=modelNode.PostRotation.value}if("Lcl_Scaling" in modelNode){transformData.scale=modelNode.Lcl_Scaling.value}if("ScalingOffset" in modelNode){transformData.scalingOffset=modelNode.ScalingOffset.value}if("ScalingPivot" in modelNode){transformData.scalingPivot=modelNode.ScalingPivot.value}if("RotationOffset" in modelNode){transformData.rotationOffset=modelNode.RotationOffset.value}if("RotationPivot" in modelNode){transformData.rotationPivot=modelNode.RotationPivot.value}model.userData.transformData=transformData},setLookAtProperties:function(model,modelNode){if("LookAtProperty" in modelNode){var children=connections.get(model.ID).children;children.forEach(function(child){if(child.relationship==="LookAtProperty"){var lookAtTarget=fbxTree.Objects.Model[child.ID];if("Lcl_Translation" in lookAtTarget){var pos=lookAtTarget.Lcl_Translation.value;if(model.target!==undefined){model.target.position.fromArray(pos);
        sceneGraph.add(model.target)}else{model.lookAt(new THREE.Vector3().fromArray(pos))}}}})}},bindSkeleton:function(skeletons,geometryMap,modelMap){var bindMatrices=this.parsePoseNodes();for(var ID in skeletons){var skeleton=skeletons[ID];var parents=connections.get(parseInt(skeleton.ID)).parents;parents.forEach(function(parent){if(geometryMap.has(parent.ID)){var geoID=parent.ID;var geoRelationships=connections.get(geoID);geoRelationships.parents.forEach(function(geoConnParent){if(modelMap.has(geoConnParent.ID)){var model=modelMap.get(geoConnParent.ID);model.bind(new THREE.Skeleton(skeleton.bones),bindMatrices[geoConnParent.ID])}})}})}},parsePoseNodes:function(){var bindMatrices={};if("Pose" in fbxTree.Objects){var BindPoseNode=fbxTree.Objects.Pose;for(var nodeID in BindPoseNode){if(BindPoseNode[nodeID].attrType==="BindPose"){var poseNodes=BindPoseNode[nodeID].PoseNode;if(Array.isArray(poseNodes)){poseNodes.forEach(function(poseNode){bindMatrices[poseNode.Node]=new THREE.Matrix4().fromArray(poseNode.Matrix.a)})}else{bindMatrices[poseNodes.Node]=new THREE.Matrix4().fromArray(poseNodes.Matrix.a)}}}}return bindMatrices},createAmbientLight:function(){if("GlobalSettings" in fbxTree&&"AmbientColor" in fbxTree.GlobalSettings){var ambientColor=fbxTree.GlobalSettings.AmbientColor.value;var r=ambientColor[0];var g=ambientColor[1];var b=ambientColor[2];if(r!==0||g!==0||b!==0){var color=new THREE.Color(r,g,b);sceneGraph.add(new THREE.AmbientLight(color,1))}}},setupMorphMaterials:function(){var self=this;sceneGraph.traverse(function(child){if(child.isMesh){if(child.geometry.morphAttributes.position&&child.geometry.morphAttributes.position.length){if(Array.isArray(child.material)){child.material.forEach(function(material,i){self.setupMorphMaterial(child,material,i)})}else{self.setupMorphMaterial(child,child.material)}}}})},setupMorphMaterial:function(child,material,index){var uuid=child.uuid;var matUuid=material.uuid;var sharedMat=false;sceneGraph.traverse(function(node){if(node.isMesh){if(Array.isArray(node.material)){node.material.forEach(function(mat){if(mat.uuid===matUuid&&node.uuid!==uuid){sharedMat=true
    }})}else{if(node.material.uuid===matUuid&&node.uuid!==uuid){sharedMat=true}}}});if(sharedMat===true){var clonedMat=material.clone();clonedMat.morphTargets=true;if(index===undefined){child.material=clonedMat}else{child.material[index]=clonedMat}}else{material.morphTargets=true}}};function GeometryParser(){}GeometryParser.prototype={constructor:GeometryParser,parse:function(deformers){var geometryMap=new Map();if("Geometry" in fbxTree.Objects){var geoNodes=fbxTree.Objects.Geometry;for(var nodeID in geoNodes){var relationships=connections.get(parseInt(nodeID));var geo=this.parseGeometry(relationships,geoNodes[nodeID],deformers);geometryMap.set(parseInt(nodeID),geo)}}return geometryMap},parseGeometry:function(relationships,geoNode,deformers){switch(geoNode.attrType){case"Mesh":return this.parseMeshGeometry(relationships,geoNode,deformers);break;case"NurbsCurve":return this.parseNurbsGeometry(geoNode);break}},parseMeshGeometry:function(relationships,geoNode,deformers){var skeletons=deformers.skeletons;var morphTargets=deformers.morphTargets;var modelNodes=relationships.parents.map(function(parent){return fbxTree.Objects.Model[parent.ID]});if(modelNodes.length===0){return}var skeleton=relationships.children.reduce(function(skeleton,child){if(skeletons[child.ID]!==undefined){skeleton=skeletons[child.ID]}return skeleton},null);var morphTarget=relationships.children.reduce(function(morphTarget,child){if(morphTargets[child.ID]!==undefined){morphTarget=morphTargets[child.ID]}return morphTarget},null);var modelNode=modelNodes[0];var transformData={};if("RotationOrder" in modelNode){transformData.eulerOrder=getEulerOrder(modelNode.RotationOrder.value)}if("InheritType" in modelNode){transformData.inheritType=parseInt(modelNode.InheritType.value)}if("GeometricTranslation" in modelNode){transformData.translation=modelNode.GeometricTranslation.value}if("GeometricRotation" in modelNode){transformData.rotation=modelNode.GeometricRotation.value}if("GeometricScaling" in modelNode){transformData.scale=modelNode.GeometricScaling.value
    }var transform=generateTransform(transformData);return this.genGeometry(geoNode,skeleton,morphTarget,transform)},genGeometry:function(geoNode,skeleton,morphTarget,preTransform){var geo=new THREE.BufferGeometry();if(geoNode.attrName){geo.name=geoNode.attrName}var geoInfo=this.parseGeoNode(geoNode,skeleton);var buffers=this.genBuffers(geoInfo);var positionAttribute=new THREE.Float32BufferAttribute(buffers.vertex,3);preTransform.applyToBufferAttribute(positionAttribute);geo.addAttribute("position",positionAttribute);if(buffers.colors.length>0){geo.addAttribute("color",new THREE.Float32BufferAttribute(buffers.colors,3))}if(skeleton){geo.addAttribute("skinIndex",new THREE.Uint16BufferAttribute(buffers.weightsIndices,4));geo.addAttribute("skinWeight",new THREE.Float32BufferAttribute(buffers.vertexWeights,4));geo.FBX_Deformer=skeleton}if(buffers.normal.length>0){var normalAttribute=new THREE.Float32BufferAttribute(buffers.normal,3);var normalMatrix=new THREE.Matrix3().getNormalMatrix(preTransform);normalMatrix.applyToBufferAttribute(normalAttribute);geo.addAttribute("normal",normalAttribute)}buffers.uvs.forEach(function(uvBuffer,i){var name="uv"+(i+1).toString();if(i===0){name="uv"}geo.addAttribute(name,new THREE.Float32BufferAttribute(buffers.uvs[i],2))});if(geoInfo.material&&geoInfo.material.mappingType!=="AllSame"){var prevMaterialIndex=buffers.materialIndex[0];var startIndex=0;buffers.materialIndex.forEach(function(currentIndex,i){if(currentIndex!==prevMaterialIndex){geo.addGroup(startIndex,i-startIndex,prevMaterialIndex);prevMaterialIndex=currentIndex;startIndex=i}});if(geo.groups.length>0){var lastGroup=geo.groups[geo.groups.length-1];var lastIndex=lastGroup.start+lastGroup.count;if(lastIndex!==buffers.materialIndex.length){geo.addGroup(lastIndex,buffers.materialIndex.length-lastIndex,prevMaterialIndex)}}if(geo.groups.length===0){geo.addGroup(0,buffers.materialIndex.length,buffers.materialIndex[0])}}this.addMorphTargets(geo,geoNode,morphTarget,preTransform);return geo
    },parseGeoNode:function(geoNode,skeleton){var geoInfo={};geoInfo.vertexPositions=(geoNode.Vertices!==undefined)?geoNode.Vertices.a:[];geoInfo.vertexIndices=(geoNode.PolygonVertexIndex!==undefined)?geoNode.PolygonVertexIndex.a:[];if(geoNode.LayerElementColor){geoInfo.color=this.parseVertexColors(geoNode.LayerElementColor[0])}if(geoNode.LayerElementMaterial){geoInfo.material=this.parseMaterialIndices(geoNode.LayerElementMaterial[0])}if(geoNode.LayerElementNormal){geoInfo.normal=this.parseNormals(geoNode.LayerElementNormal[0])}if(geoNode.LayerElementUV){geoInfo.uv=[];var i=0;while(geoNode.LayerElementUV[i]){geoInfo.uv.push(this.parseUVs(geoNode.LayerElementUV[i]));i++}}geoInfo.weightTable={};if(skeleton!==null){geoInfo.skeleton=skeleton;skeleton.rawBones.forEach(function(rawBone,i){rawBone.indices.forEach(function(index,j){if(geoInfo.weightTable[index]===undefined){geoInfo.weightTable[index]=[]}geoInfo.weightTable[index].push({id:i,weight:rawBone.weights[j],})})})}return geoInfo},genBuffers:function(geoInfo){var buffers={vertex:[],normal:[],colors:[],uvs:[],materialIndex:[],vertexWeights:[],weightsIndices:[],};var polygonIndex=0;var faceLength=0;var displayedWeightsWarning=false;var facePositionIndexes=[];var faceNormals=[];var faceColors=[];var faceUVs=[];var faceWeights=[];var faceWeightIndices=[];var self=this;geoInfo.vertexIndices.forEach(function(vertexIndex,polygonVertexIndex){var endOfFace=false;if(vertexIndex<0){vertexIndex=vertexIndex^-1;endOfFace=true}var weightIndices=[];var weights=[];facePositionIndexes.push(vertexIndex*3,vertexIndex*3+1,vertexIndex*3+2);if(geoInfo.color){var data=getData(polygonVertexIndex,polygonIndex,vertexIndex,geoInfo.color);faceColors.push(data[0],data[1],data[2])}if(geoInfo.skeleton){if(geoInfo.weightTable[vertexIndex]!==undefined){geoInfo.weightTable[vertexIndex].forEach(function(wt){weights.push(wt.weight);weightIndices.push(wt.id)})}if(weights.length>4){if(!displayedWeightsWarning){console.warn("THREE.FBXLoader: Vertex has more than 4 skinning weights assigned to vertex. Deleting additional weights.");
        displayedWeightsWarning=true}var wIndex=[0,0,0,0];var Weight=[0,0,0,0];weights.forEach(function(weight,weightIndex){var currentWeight=weight;var currentIndex=weightIndices[weightIndex];Weight.forEach(function(comparedWeight,comparedWeightIndex,comparedWeightArray){if(currentWeight>comparedWeight){comparedWeightArray[comparedWeightIndex]=currentWeight;currentWeight=comparedWeight;var tmp=wIndex[comparedWeightIndex];wIndex[comparedWeightIndex]=currentIndex;currentIndex=tmp}})});weightIndices=wIndex;weights=Weight}while(weights.length<4){weights.push(0);weightIndices.push(0)}for(var i=0;i<4;++i){faceWeights.push(weights[i]);faceWeightIndices.push(weightIndices[i])}}if(geoInfo.normal){var data=getData(polygonVertexIndex,polygonIndex,vertexIndex,geoInfo.normal);faceNormals.push(data[0],data[1],data[2])}if(geoInfo.material&&geoInfo.material.mappingType!=="AllSame"){var materialIndex=getData(polygonVertexIndex,polygonIndex,vertexIndex,geoInfo.material)[0]}if(geoInfo.uv){geoInfo.uv.forEach(function(uv,i){var data=getData(polygonVertexIndex,polygonIndex,vertexIndex,uv);if(faceUVs[i]===undefined){faceUVs[i]=[]}faceUVs[i].push(data[0]);faceUVs[i].push(data[1])})}faceLength++;if(endOfFace){self.genFace(buffers,geoInfo,facePositionIndexes,materialIndex,faceNormals,faceColors,faceUVs,faceWeights,faceWeightIndices,faceLength);polygonIndex++;faceLength=0;facePositionIndexes=[];faceNormals=[];faceColors=[];faceUVs=[];faceWeights=[];faceWeightIndices=[]}});return buffers},genFace:function(buffers,geoInfo,facePositionIndexes,materialIndex,faceNormals,faceColors,faceUVs,faceWeights,faceWeightIndices,faceLength){for(var i=2;i<faceLength;i++){buffers.vertex.push(geoInfo.vertexPositions[facePositionIndexes[0]]);buffers.vertex.push(geoInfo.vertexPositions[facePositionIndexes[1]]);buffers.vertex.push(geoInfo.vertexPositions[facePositionIndexes[2]]);buffers.vertex.push(geoInfo.vertexPositions[facePositionIndexes[(i-1)*3]]);buffers.vertex.push(geoInfo.vertexPositions[facePositionIndexes[(i-1)*3+1]]);
        buffers.vertex.push(geoInfo.vertexPositions[facePositionIndexes[(i-1)*3+2]]);buffers.vertex.push(geoInfo.vertexPositions[facePositionIndexes[i*3]]);buffers.vertex.push(geoInfo.vertexPositions[facePositionIndexes[i*3+1]]);buffers.vertex.push(geoInfo.vertexPositions[facePositionIndexes[i*3+2]]);if(geoInfo.skeleton){buffers.vertexWeights.push(faceWeights[0]);buffers.vertexWeights.push(faceWeights[1]);buffers.vertexWeights.push(faceWeights[2]);buffers.vertexWeights.push(faceWeights[3]);buffers.vertexWeights.push(faceWeights[(i-1)*4]);buffers.vertexWeights.push(faceWeights[(i-1)*4+1]);buffers.vertexWeights.push(faceWeights[(i-1)*4+2]);buffers.vertexWeights.push(faceWeights[(i-1)*4+3]);buffers.vertexWeights.push(faceWeights[i*4]);buffers.vertexWeights.push(faceWeights[i*4+1]);buffers.vertexWeights.push(faceWeights[i*4+2]);buffers.vertexWeights.push(faceWeights[i*4+3]);buffers.weightsIndices.push(faceWeightIndices[0]);buffers.weightsIndices.push(faceWeightIndices[1]);buffers.weightsIndices.push(faceWeightIndices[2]);buffers.weightsIndices.push(faceWeightIndices[3]);buffers.weightsIndices.push(faceWeightIndices[(i-1)*4]);buffers.weightsIndices.push(faceWeightIndices[(i-1)*4+1]);buffers.weightsIndices.push(faceWeightIndices[(i-1)*4+2]);buffers.weightsIndices.push(faceWeightIndices[(i-1)*4+3]);buffers.weightsIndices.push(faceWeightIndices[i*4]);buffers.weightsIndices.push(faceWeightIndices[i*4+1]);buffers.weightsIndices.push(faceWeightIndices[i*4+2]);buffers.weightsIndices.push(faceWeightIndices[i*4+3])}if(geoInfo.color){buffers.colors.push(faceColors[0]);buffers.colors.push(faceColors[1]);buffers.colors.push(faceColors[2]);buffers.colors.push(faceColors[(i-1)*3]);buffers.colors.push(faceColors[(i-1)*3+1]);buffers.colors.push(faceColors[(i-1)*3+2]);buffers.colors.push(faceColors[i*3]);buffers.colors.push(faceColors[i*3+1]);buffers.colors.push(faceColors[i*3+2])}if(geoInfo.material&&geoInfo.material.mappingType!=="AllSame"){buffers.materialIndex.push(materialIndex);buffers.materialIndex.push(materialIndex);
            buffers.materialIndex.push(materialIndex)}if(geoInfo.normal){buffers.normal.push(faceNormals[0]);buffers.normal.push(faceNormals[1]);buffers.normal.push(faceNormals[2]);buffers.normal.push(faceNormals[(i-1)*3]);buffers.normal.push(faceNormals[(i-1)*3+1]);buffers.normal.push(faceNormals[(i-1)*3+2]);buffers.normal.push(faceNormals[i*3]);buffers.normal.push(faceNormals[i*3+1]);buffers.normal.push(faceNormals[i*3+2])}if(geoInfo.uv){geoInfo.uv.forEach(function(uv,j){if(buffers.uvs[j]===undefined){buffers.uvs[j]=[]}buffers.uvs[j].push(faceUVs[j][0]);buffers.uvs[j].push(faceUVs[j][1]);buffers.uvs[j].push(faceUVs[j][(i-1)*2]);buffers.uvs[j].push(faceUVs[j][(i-1)*2+1]);buffers.uvs[j].push(faceUVs[j][i*2]);buffers.uvs[j].push(faceUVs[j][i*2+1])})}}},addMorphTargets:function(parentGeo,parentGeoNode,morphTarget,preTransform){if(morphTarget===null){return}parentGeo.morphAttributes.position=[];var self=this;morphTarget.rawTargets.forEach(function(rawTarget){var morphGeoNode=fbxTree.Objects.Geometry[rawTarget.geoID];if(morphGeoNode!==undefined){self.genMorphGeometry(parentGeo,parentGeoNode,morphGeoNode,preTransform,rawTarget.name)}})},genMorphGeometry:function(parentGeo,parentGeoNode,morphGeoNode,preTransform,name){var morphGeo=new THREE.BufferGeometry();if(morphGeoNode.attrName){morphGeo.name=morphGeoNode.attrName}var vertexIndices=(parentGeoNode.PolygonVertexIndex!==undefined)?parentGeoNode.PolygonVertexIndex.a:[];var vertexPositions=(parentGeoNode.Vertices!==undefined)?parentGeoNode.Vertices.a.slice():[];var morphPositions=(morphGeoNode.Vertices!==undefined)?morphGeoNode.Vertices.a:[];var indices=(morphGeoNode.Indexes!==undefined)?morphGeoNode.Indexes.a:[];for(var i=0;i<indices.length;i++){var morphIndex=indices[i]*3;vertexPositions[morphIndex]+=morphPositions[i*3];vertexPositions[morphIndex+1]+=morphPositions[i*3+1];vertexPositions[morphIndex+2]+=morphPositions[i*3+2]}var morphGeoInfo={vertexIndices:vertexIndices,vertexPositions:vertexPositions,};var morphBuffers=this.genBuffers(morphGeoInfo);
        var positionAttribute=new THREE.Float32BufferAttribute(morphBuffers.vertex,3);positionAttribute.name=name||morphGeoNode.attrName;preTransform.applyToBufferAttribute(positionAttribute);parentGeo.morphAttributes.position.push(positionAttribute)},parseNormals:function(NormalNode){var mappingType=NormalNode.MappingInformationType;var referenceType=NormalNode.ReferenceInformationType;var buffer=NormalNode.Normals.a;var indexBuffer=[];if(referenceType==="IndexToDirect"){if("NormalIndex" in NormalNode){indexBuffer=NormalNode.NormalIndex.a}else{if("NormalsIndex" in NormalNode){indexBuffer=NormalNode.NormalsIndex.a}}}return{dataSize:3,buffer:buffer,indices:indexBuffer,mappingType:mappingType,referenceType:referenceType}},parseUVs:function(UVNode){var mappingType=UVNode.MappingInformationType;var referenceType=UVNode.ReferenceInformationType;var buffer=UVNode.UV.a;var indexBuffer=[];if(referenceType==="IndexToDirect"){indexBuffer=UVNode.UVIndex.a}return{dataSize:2,buffer:buffer,indices:indexBuffer,mappingType:mappingType,referenceType:referenceType}},parseVertexColors:function(ColorNode){var mappingType=ColorNode.MappingInformationType;var referenceType=ColorNode.ReferenceInformationType;var buffer=ColorNode.Colors.a;var indexBuffer=[];if(referenceType==="IndexToDirect"){indexBuffer=ColorNode.ColorIndex.a}return{dataSize:4,buffer:buffer,indices:indexBuffer,mappingType:mappingType,referenceType:referenceType}},parseMaterialIndices:function(MaterialNode){var mappingType=MaterialNode.MappingInformationType;var referenceType=MaterialNode.ReferenceInformationType;if(mappingType==="NoMappingInformation"){return{dataSize:1,buffer:[0],indices:[0],mappingType:"AllSame",referenceType:referenceType}}var materialIndexBuffer=MaterialNode.Materials.a;var materialIndices=[];for(var i=0;i<materialIndexBuffer.length;++i){materialIndices.push(i)}return{dataSize:1,buffer:materialIndexBuffer,indices:materialIndices,mappingType:mappingType,referenceType:referenceType}},parseNurbsGeometry:function(geoNode){if(THREE.NURBSCurve===undefined){console.error("THREE.FBXLoader: The loader relies on THREE.NURBSCurve for any nurbs present in the model. Nurbs will show up as empty geometry.");
        return new THREE.BufferGeometry()}var order=parseInt(geoNode.Order);if(isNaN(order)){console.error("THREE.FBXLoader: Invalid Order %s given for geometry ID: %s",geoNode.Order,geoNode.id);return new THREE.BufferGeometry()}var degree=order-1;var knots=geoNode.KnotVector.a;var controlPoints=[];var pointsValues=geoNode.Points.a;for(var i=0,l=pointsValues.length;i<l;i+=4){controlPoints.push(new THREE.Vector4().fromArray(pointsValues,i))}var startKnot,endKnot;if(geoNode.Form==="Closed"){controlPoints.push(controlPoints[0])}else{if(geoNode.Form==="Periodic"){startKnot=degree;endKnot=knots.length-1-startKnot;for(var i=0;i<degree;++i){controlPoints.push(controlPoints[i])}}}var curve=new THREE.NURBSCurve(degree,knots,controlPoints,startKnot,endKnot);var vertices=curve.getPoints(controlPoints.length*7);var positions=new Float32Array(vertices.length*3);vertices.forEach(function(vertex,i){vertex.toArray(positions,i*3)});var geometry=new THREE.BufferGeometry();geometry.addAttribute("position",new THREE.BufferAttribute(positions,3));return geometry},};function AnimationParser(){}AnimationParser.prototype={constructor:AnimationParser,parse:function(){var animationClips=[];var rawClips=this.parseClips();if(rawClips===undefined){return}for(var key in rawClips){var rawClip=rawClips[key];var clip=this.addClip(rawClip);animationClips.push(clip)}return animationClips},parseClips:function(){if(fbxTree.Objects.AnimationCurve===undefined){return undefined}var curveNodesMap=this.parseAnimationCurveNodes();this.parseAnimationCurves(curveNodesMap);var layersMap=this.parseAnimationLayers(curveNodesMap);var rawClips=this.parseAnimStacks(layersMap);return rawClips},parseAnimationCurveNodes:function(){var rawCurveNodes=fbxTree.Objects.AnimationCurveNode;var curveNodesMap=new Map();for(var nodeID in rawCurveNodes){var rawCurveNode=rawCurveNodes[nodeID];if(rawCurveNode.attrName.match(/S|R|T|DeformPercent/)!==null){var curveNode={id:rawCurveNode.id,attr:rawCurveNode.attrName,curves:{},};curveNodesMap.set(curveNode.id,curveNode)
    }}return curveNodesMap},parseAnimationCurves:function(curveNodesMap){var rawCurves=fbxTree.Objects.AnimationCurve;for(var nodeID in rawCurves){var animationCurve={id:rawCurves[nodeID].id,times:rawCurves[nodeID].KeyTime.a.map(convertFBXTimeToSeconds),values:rawCurves[nodeID].KeyValueFloat.a,};var relationships=connections.get(animationCurve.id);if(relationships!==undefined){var animationCurveID=relationships.parents[0].ID;var animationCurveRelationship=relationships.parents[0].relationship;if(animationCurveRelationship.match(/X/)){curveNodesMap.get(animationCurveID).curves["x"]=animationCurve}else{if(animationCurveRelationship.match(/Y/)){curveNodesMap.get(animationCurveID).curves["y"]=animationCurve}else{if(animationCurveRelationship.match(/Z/)){curveNodesMap.get(animationCurveID).curves["z"]=animationCurve}else{if(animationCurveRelationship.match(/d|DeformPercent/)&&curveNodesMap.has(animationCurveID)){curveNodesMap.get(animationCurveID).curves["morph"]=animationCurve}}}}}}},parseAnimationLayers:function(curveNodesMap){var rawLayers=fbxTree.Objects.AnimationLayer;var layersMap=new Map();for(var nodeID in rawLayers){var layerCurveNodes=[];var connection=connections.get(parseInt(nodeID));if(connection!==undefined){var children=connection.children;children.forEach(function(child,i){if(curveNodesMap.has(child.ID)){var curveNode=curveNodesMap.get(child.ID);if(curveNode.curves.x!==undefined||curveNode.curves.y!==undefined||curveNode.curves.z!==undefined){if(layerCurveNodes[i]===undefined){var modelID=connections.get(child.ID).parents.filter(function(parent){return parent.relationship!==undefined})[0].ID;if(modelID!==undefined){var rawModel=fbxTree.Objects.Model[modelID.toString()];var node={modelName:THREE.PropertyBinding.sanitizeNodeName(rawModel.attrName),ID:rawModel.id,initialPosition:[0,0,0],initialRotation:[0,0,0],initialScale:[1,1,1],};sceneGraph.traverse(function(child){if(child.ID=rawModel.id){node.transform=child.matrix;if(child.userData.transformData){node.eulerOrder=child.userData.transformData.eulerOrder
    }}});if(!node.transform){node.transform=new THREE.Matrix4()}if("PreRotation" in rawModel){node.preRotation=rawModel.PreRotation.value}if("PostRotation" in rawModel){node.postRotation=rawModel.PostRotation.value}layerCurveNodes[i]=node}}if(layerCurveNodes[i]){layerCurveNodes[i][curveNode.attr]=curveNode}}else{if(curveNode.curves.morph!==undefined){if(layerCurveNodes[i]===undefined){var deformerID=connections.get(child.ID).parents.filter(function(parent){return parent.relationship!==undefined})[0].ID;var morpherID=connections.get(deformerID).parents[0].ID;var geoID=connections.get(morpherID).parents[0].ID;var modelID=connections.get(geoID).parents[0].ID;var rawModel=fbxTree.Objects.Model[modelID];var node={modelName:THREE.PropertyBinding.sanitizeNodeName(rawModel.attrName),morphName:fbxTree.Objects.Deformer[deformerID].attrName,};layerCurveNodes[i]=node}layerCurveNodes[i][curveNode.attr]=curveNode}}}});layersMap.set(parseInt(nodeID),layerCurveNodes)}}return layersMap},parseAnimStacks:function(layersMap){var rawStacks=fbxTree.Objects.AnimationStack;var rawClips={};for(var nodeID in rawStacks){var children=connections.get(parseInt(nodeID)).children;if(children.length>1){console.warn("THREE.FBXLoader: Encountered an animation stack with multiple layers, this is currently not supported. Ignoring subsequent layers.")}var layer=layersMap.get(children[0].ID);rawClips[nodeID]={name:rawStacks[nodeID].attrName,layer:layer,}}return rawClips},addClip:function(rawClip){var tracks=[];var self=this;rawClip.layer.forEach(function(rawTracks){tracks=tracks.concat(self.generateTracks(rawTracks))});return new THREE.AnimationClip(rawClip.name,-1,tracks)},generateTracks:function(rawTracks){var tracks=[];var initialPosition=new THREE.Vector3();var initialRotation=new THREE.Quaternion();var initialScale=new THREE.Vector3();if(rawTracks.transform){rawTracks.transform.decompose(initialPosition,initialRotation,initialScale)}initialPosition=initialPosition.toArray();initialRotation=new THREE.Euler().setFromQuaternion(initialRotation,rawTracks.eulerOrder).toArray();
        initialScale=initialScale.toArray();if(rawTracks.T!==undefined&&Object.keys(rawTracks.T.curves).length>0){var positionTrack=this.generateVectorTrack(rawTracks.modelName,rawTracks.T.curves,initialPosition,"position");if(positionTrack!==undefined){tracks.push(positionTrack)}}if(rawTracks.R!==undefined&&Object.keys(rawTracks.R.curves).length>0){var rotationTrack=this.generateRotationTrack(rawTracks.modelName,rawTracks.R.curves,initialRotation,rawTracks.preRotation,rawTracks.postRotation,rawTracks.eulerOrder);if(rotationTrack!==undefined){tracks.push(rotationTrack)}}if(rawTracks.S!==undefined&&Object.keys(rawTracks.S.curves).length>0){var scaleTrack=this.generateVectorTrack(rawTracks.modelName,rawTracks.S.curves,initialScale,"scale");if(scaleTrack!==undefined){tracks.push(scaleTrack)}}if(rawTracks.DeformPercent!==undefined){var morphTrack=this.generateMorphTrack(rawTracks);if(morphTrack!==undefined){tracks.push(morphTrack)}}return tracks},generateVectorTrack:function(modelName,curves,initialValue,type){var times=this.getTimesForAllAxes(curves);var values=this.getKeyframeTrackValues(times,curves,initialValue);return new THREE.VectorKeyframeTrack(modelName+"."+type,times,values)},generateRotationTrack:function(modelName,curves,initialValue,preRotation,postRotation,eulerOrder){if(curves.x!==undefined){this.interpolateRotations(curves.x);curves.x.values=curves.x.values.map(THREE.Math.degToRad)}if(curves.y!==undefined){this.interpolateRotations(curves.y);curves.y.values=curves.y.values.map(THREE.Math.degToRad)}if(curves.z!==undefined){this.interpolateRotations(curves.z);curves.z.values=curves.z.values.map(THREE.Math.degToRad)}var times=this.getTimesForAllAxes(curves);var values=this.getKeyframeTrackValues(times,curves,initialValue);if(preRotation!==undefined){preRotation=preRotation.map(THREE.Math.degToRad);preRotation.push(eulerOrder);preRotation=new THREE.Euler().fromArray(preRotation);preRotation=new THREE.Quaternion().setFromEuler(preRotation)}if(postRotation!==undefined){postRotation=postRotation.map(THREE.Math.degToRad);
        postRotation.push(eulerOrder);postRotation=new THREE.Euler().fromArray(postRotation);postRotation=new THREE.Quaternion().setFromEuler(postRotation).inverse()}var quaternion=new THREE.Quaternion();var euler=new THREE.Euler();var quaternionValues=[];for(var i=0;i<values.length;i+=3){euler.set(values[i],values[i+1],values[i+2],eulerOrder);quaternion.setFromEuler(euler);if(preRotation!==undefined){quaternion.premultiply(preRotation)}if(postRotation!==undefined){quaternion.multiply(postRotation)}quaternion.toArray(quaternionValues,(i/3)*4)}return new THREE.QuaternionKeyframeTrack(modelName+".quaternion",times,quaternionValues)},generateMorphTrack:function(rawTracks){var curves=rawTracks.DeformPercent.curves.morph;var values=curves.values.map(function(val){return val/100});var morphNum=sceneGraph.getObjectByName(rawTracks.modelName).morphTargetDictionary[rawTracks.morphName];return new THREE.NumberKeyframeTrack(rawTracks.modelName+".morphTargetInfluences["+morphNum+"]",curves.times,values)},getTimesForAllAxes:function(curves){var times=[];if(curves.x!==undefined){times=times.concat(curves.x.times)}if(curves.y!==undefined){times=times.concat(curves.y.times)}if(curves.z!==undefined){times=times.concat(curves.z.times)}times=times.sort(function(a,b){return a-b}).filter(function(elem,index,array){return array.indexOf(elem)==index});return times},getKeyframeTrackValues:function(times,curves,initialValue){var prevValue=initialValue;var values=[];var xIndex=-1;var yIndex=-1;var zIndex=-1;times.forEach(function(time){if(curves.x){xIndex=curves.x.times.indexOf(time)}if(curves.y){yIndex=curves.y.times.indexOf(time)}if(curves.z){zIndex=curves.z.times.indexOf(time)}if(xIndex!==-1){var xValue=curves.x.values[xIndex];values.push(xValue);prevValue[0]=xValue}else{values.push(prevValue[0])}if(yIndex!==-1){var yValue=curves.y.values[yIndex];values.push(yValue);prevValue[1]=yValue}else{values.push(prevValue[1])}if(zIndex!==-1){var zValue=curves.z.values[zIndex];values.push(zValue);prevValue[2]=zValue
    }else{values.push(prevValue[2])}});return values},interpolateRotations:function(curve){for(var i=1;i<curve.values.length;i++){var initialValue=curve.values[i-1];var valuesSpan=curve.values[i]-initialValue;var absoluteSpan=Math.abs(valuesSpan);if(absoluteSpan>=180){var numSubIntervals=absoluteSpan/180;var step=valuesSpan/numSubIntervals;var nextValue=initialValue+step;var initialTime=curve.times[i-1];var timeSpan=curve.times[i]-initialTime;var interval=timeSpan/numSubIntervals;var nextTime=initialTime+interval;var interpolatedTimes=[];var interpolatedValues=[];while(nextTime<curve.times[i]){interpolatedTimes.push(nextTime);nextTime+=interval;interpolatedValues.push(nextValue);nextValue+=step}curve.times=inject(curve.times,i,interpolatedTimes);curve.values=inject(curve.values,i,interpolatedValues)}}},};function TextParser(){}TextParser.prototype={constructor:TextParser,getPrevNode:function(){return this.nodeStack[this.currentIndent-2]},getCurrentNode:function(){return this.nodeStack[this.currentIndent-1]},getCurrentProp:function(){return this.currentProp},pushStack:function(node){this.nodeStack.push(node);this.currentIndent+=1},popStack:function(){this.nodeStack.pop();this.currentIndent-=1},setCurrentProp:function(val,name){this.currentProp=val;this.currentPropName=name},parse:function(text){this.currentIndent=0;this.allNodes=new FBXTree();this.nodeStack=[];this.currentProp=[];this.currentPropName="";var self=this;var split=text.split(/[\r\n]+/);split.forEach(function(line,i){var matchComment=line.match(/^[\s\t]*;/);var matchEmpty=line.match(/^[\s\t]*$/);if(matchComment||matchEmpty){return}var matchBeginning=line.match("^\\t{"+self.currentIndent+"}(\\w+):(.*){","");var matchProperty=line.match("^\\t{"+(self.currentIndent)+"}(\\w+):[\\s\\t\\r\\n](.*)");var matchEnd=line.match("^\\t{"+(self.currentIndent-1)+"}}");if(matchBeginning){self.parseNodeBegin(line,matchBeginning)}else{if(matchProperty){self.parseNodeProperty(line,matchProperty,split[++i])}else{if(matchEnd){self.popStack()
    }else{if(line.match(/^[^\s\t}]/)){self.parseNodePropertyContinued(line)}}}}});return this.allNodes},parseNodeBegin:function(line,property){var nodeName=property[1].trim().replace(/^"/,"").replace(/"$/,"");var nodeAttrs=property[2].split(",").map(function(attr){return attr.trim().replace(/^"/,"").replace(/"$/,"")});var node={name:nodeName};var attrs=this.parseNodeAttr(nodeAttrs);var currentNode=this.getCurrentNode();if(this.currentIndent===0){this.allNodes.add(nodeName,node)}else{if(nodeName in currentNode){if(nodeName==="PoseNode"){currentNode.PoseNode.push(node)}else{if(currentNode[nodeName].id!==undefined){currentNode[nodeName]={};currentNode[nodeName][currentNode[nodeName].id]=currentNode[nodeName]}}if(attrs.id!==""){currentNode[nodeName][attrs.id]=node}}else{if(typeof attrs.id==="number"){currentNode[nodeName]={};currentNode[nodeName][attrs.id]=node}else{if(nodeName!=="Properties70"){if(nodeName==="PoseNode"){currentNode[nodeName]=[node]}else{currentNode[nodeName]=node}}}}}if(typeof attrs.id==="number"){node.id=attrs.id}if(attrs.name!==""){node.attrName=attrs.name}if(attrs.type!==""){node.attrType=attrs.type}this.pushStack(node)},parseNodeAttr:function(attrs){var id=attrs[0];if(attrs[0]!==""){id=parseInt(attrs[0]);if(isNaN(id)){id=attrs[0]}}var name="",type="";if(attrs.length>1){name=attrs[1].replace(/^(\w+)::/,"");type=attrs[2]}return{id:id,name:name,type:type}},parseNodeProperty:function(line,property,contentLine){var propName=property[1].replace(/^"/,"").replace(/"$/,"").trim();var propValue=property[2].replace(/^"/,"").replace(/"$/,"").trim();if(propName==="Content"&&propValue===","){propValue=contentLine.replace(/"/g,"").replace(/,$/,"").trim()}var currentNode=this.getCurrentNode();var parentName=currentNode.name;if(parentName==="Properties70"){this.parseNodeSpecialProperty(line,propName,propValue);return}if(propName==="C"){var connProps=propValue.split(",").slice(1);var from=parseInt(connProps[0]);var to=parseInt(connProps[1]);var rest=propValue.split(",").slice(3);
        rest=rest.map(function(elem){return elem.trim().replace(/^"/,"")});propName="connections";propValue=[from,to];append(propValue,rest);if(currentNode[propName]===undefined){currentNode[propName]=[]}}if(propName==="Node"){currentNode.id=propValue}if(propName in currentNode&&Array.isArray(currentNode[propName])){currentNode[propName].push(propValue)}else{if(propName!=="a"){currentNode[propName]=propValue}else{currentNode.a=propValue}}this.setCurrentProp(currentNode,propName);if(propName==="a"&&propValue.slice(-1)!==","){currentNode.a=parseNumberArray(propValue)}},parseNodePropertyContinued:function(line){var currentNode=this.getCurrentNode();currentNode.a+=line;if(line.slice(-1)!==","){currentNode.a=parseNumberArray(currentNode.a)}},parseNodeSpecialProperty:function(line,propName,propValue){var props=propValue.split('",').map(function(prop){return prop.trim().replace(/^\"/,"").replace(/\s/,"_")});var innerPropName=props[0];var innerPropType1=props[1];var innerPropType2=props[2];var innerPropFlag=props[3];var innerPropValue=props[4];switch(innerPropType1){case"int":case"enum":case"bool":case"ULongLong":case"double":case"Number":case"FieldOfView":innerPropValue=parseFloat(innerPropValue);break;case"Color":case"ColorRGB":case"Vector3D":case"Lcl_Translation":case"Lcl_Rotation":case"Lcl_Scaling":innerPropValue=parseNumberArray(innerPropValue);break}this.getPrevNode()[innerPropName]={"type":innerPropType1,"type2":innerPropType2,"flag":innerPropFlag,"value":innerPropValue};this.setCurrentProp(this.getPrevNode(),innerPropName)},};function BinaryParser(){}BinaryParser.prototype={constructor:BinaryParser,parse:function(buffer){var reader=new BinaryReader(buffer);reader.skip(23);var version=reader.getUint32();console.log("THREE.FBXLoader: FBX binary version: "+version);var allNodes=new FBXTree();while(!this.endOfContent(reader)){var node=this.parseNode(reader,version);if(node!==null){allNodes.add(node.name,node)}}return allNodes},endOfContent:function(reader){if(reader.size()%16===0){return((reader.getOffset()+160+16)&~15)>=reader.size()
    }else{return reader.getOffset()+160+16>=reader.size()}},parseNode:function(reader,version){var node={};var endOffset=(version>=7500)?reader.getUint64():reader.getUint32();var numProperties=(version>=7500)?reader.getUint64():reader.getUint32();var propertyListLen=(version>=7500)?reader.getUint64():reader.getUint32();var nameLen=reader.getUint8();var name=reader.getString(nameLen);if(endOffset===0){return null}var propertyList=[];for(var i=0;i<numProperties;i++){propertyList.push(this.parseProperty(reader))}var id=propertyList.length>0?propertyList[0]:"";var attrName=propertyList.length>1?propertyList[1]:"";var attrType=propertyList.length>2?propertyList[2]:"";node.singleProperty=(numProperties===1&&reader.getOffset()===endOffset)?true:false;while(endOffset>reader.getOffset()){var subNode=this.parseNode(reader,version);if(subNode!==null){this.parseSubNode(name,node,subNode)}}node.propertyList=propertyList;if(typeof id==="number"){node.id=id}if(attrName!==""){node.attrName=attrName}if(attrType!==""){node.attrType=attrType}if(name!==""){node.name=name}return node},parseSubNode:function(name,node,subNode){if(subNode.singleProperty===true){var value=subNode.propertyList[0];if(Array.isArray(value)){node[subNode.name]=subNode;subNode.a=value}else{node[subNode.name]=value}}else{if(name==="Connections"&&subNode.name==="C"){var array=[];subNode.propertyList.forEach(function(property,i){if(i!==0){array.push(property)}});if(node.connections===undefined){node.connections=[]}node.connections.push(array)}else{if(subNode.name==="Properties70"){var keys=Object.keys(subNode);keys.forEach(function(key){node[key]=subNode[key]})}else{if(name==="Properties70"&&subNode.name==="P"){var innerPropName=subNode.propertyList[0];var innerPropType1=subNode.propertyList[1];var innerPropType2=subNode.propertyList[2];var innerPropFlag=subNode.propertyList[3];var innerPropValue;if(innerPropName.indexOf("Lcl ")===0){innerPropName=innerPropName.replace("Lcl ","Lcl_")}if(innerPropType1.indexOf("Lcl ")===0){innerPropType1=innerPropType1.replace("Lcl ","Lcl_")
    }if(innerPropType1==="Color"||innerPropType1==="ColorRGB"||innerPropType1==="Vector"||innerPropType1==="Vector3D"||innerPropType1.indexOf("Lcl_")===0){innerPropValue=[subNode.propertyList[4],subNode.propertyList[5],subNode.propertyList[6]]}else{innerPropValue=subNode.propertyList[4]}node[innerPropName]={"type":innerPropType1,"type2":innerPropType2,"flag":innerPropFlag,"value":innerPropValue}}else{if(node[subNode.name]===undefined){if(typeof subNode.id==="number"){node[subNode.name]={};node[subNode.name][subNode.id]=subNode}else{node[subNode.name]=subNode}}else{if(subNode.name==="PoseNode"){if(!Array.isArray(node[subNode.name])){node[subNode.name]=[node[subNode.name]]}node[subNode.name].push(subNode)}else{if(node[subNode.name][subNode.id]===undefined){node[subNode.name][subNode.id]=subNode}}}}}}}},parseProperty:function(reader){var type=reader.getString(1);switch(type){case"C":return reader.getBoolean();case"D":return reader.getFloat64();case"F":return reader.getFloat32();case"I":return reader.getInt32();case"L":return reader.getInt64();case"R":var length=reader.getUint32();return reader.getArrayBuffer(length);case"S":var length=reader.getUint32();return reader.getString(length);case"Y":return reader.getInt16();case"b":case"c":case"d":case"f":case"i":case"l":var arrayLength=reader.getUint32();var encoding=reader.getUint32();var compressedLength=reader.getUint32();if(encoding===0){switch(type){case"b":case"c":return reader.getBooleanArray(arrayLength);case"d":return reader.getFloat64Array(arrayLength);case"f":return reader.getFloat32Array(arrayLength);case"i":return reader.getInt32Array(arrayLength);case"l":return reader.getInt64Array(arrayLength)}}if(typeof Zlib==="undefined"){console.error("THREE.FBXLoader: External library Inflate.min.js required, obtain or import from https://github.com/imaya/zlib.js")}var inflate=new Zlib.Inflate(new Uint8Array(reader.getArrayBuffer(compressedLength)));var reader2=new BinaryReader(inflate.decompress().buffer);switch(type){case"b":case"c":return reader2.getBooleanArray(arrayLength);
        case"d":return reader2.getFloat64Array(arrayLength);case"f":return reader2.getFloat32Array(arrayLength);case"i":return reader2.getInt32Array(arrayLength);case"l":return reader2.getInt64Array(arrayLength)}default:throw new Error("THREE.FBXLoader: Unknown property type "+type)}}};function BinaryReader(buffer,littleEndian){this.dv=new DataView(buffer);this.offset=0;this.littleEndian=(littleEndian!==undefined)?littleEndian:true}BinaryReader.prototype={constructor:BinaryReader,getOffset:function(){return this.offset},size:function(){return this.dv.buffer.byteLength},skip:function(length){this.offset+=length},getBoolean:function(){return(this.getUint8()&1)===1},getBooleanArray:function(size){var a=[];for(var i=0;i<size;i++){a.push(this.getBoolean())}return a},getUint8:function(){var value=this.dv.getUint8(this.offset);this.offset+=1;return value},getInt16:function(){var value=this.dv.getInt16(this.offset,this.littleEndian);this.offset+=2;return value},getInt32:function(){var value=this.dv.getInt32(this.offset,this.littleEndian);this.offset+=4;return value},getInt32Array:function(size){var a=[];for(var i=0;i<size;i++){a.push(this.getInt32())}return a},getUint32:function(){var value=this.dv.getUint32(this.offset,this.littleEndian);this.offset+=4;return value},getInt64:function(){var low,high;if(this.littleEndian){low=this.getUint32();high=this.getUint32()}else{high=this.getUint32();low=this.getUint32()}if(high&2147483648){high=~high&4294967295;low=~low&4294967295;if(low===4294967295){high=(high+1)&4294967295}low=(low+1)&4294967295;return -(high*4294967296+low)}return high*4294967296+low},getInt64Array:function(size){var a=[];for(var i=0;i<size;i++){a.push(this.getInt64())}return a},getUint64:function(){var low,high;if(this.littleEndian){low=this.getUint32();high=this.getUint32()}else{high=this.getUint32();low=this.getUint32()}return high*4294967296+low},getFloat32:function(){var value=this.dv.getFloat32(this.offset,this.littleEndian);this.offset+=4;return value},getFloat32Array:function(size){var a=[];
        for(var i=0;i<size;i++){a.push(this.getFloat32())}return a},getFloat64:function(){var value=this.dv.getFloat64(this.offset,this.littleEndian);this.offset+=8;return value},getFloat64Array:function(size){var a=[];for(var i=0;i<size;i++){a.push(this.getFloat64())}return a},getArrayBuffer:function(size){var value=this.dv.buffer.slice(this.offset,this.offset+size);this.offset+=size;return value},getString:function(size){var a=[];for(var i=0;i<size;i++){a[i]=this.getUint8()}var nullByte=a.indexOf(0);if(nullByte>=0){a=a.slice(0,nullByte)}return THREE.LoaderUtils.decodeText(new Uint8Array(a))}};function FBXTree(){}FBXTree.prototype={constructor:FBXTree,add:function(key,val){this[key]=val},};function isFbxFormatBinary(buffer){var CORRECT="Kaydara FBX Binary  \0";return buffer.byteLength>=CORRECT.length&&CORRECT===convertArrayBufferToString(buffer,0,CORRECT.length)}function isFbxFormatASCII(text){var CORRECT=["K","a","y","d","a","r","a","\\","F","B","X","\\","B","i","n","a","r","y","\\","\\"];var cursor=0;function read(offset){var result=text[offset-1];text=text.slice(cursor+offset);cursor++;return result}for(var i=0;i<CORRECT.length;++i){var num=read(1);if(num===CORRECT[i]){return false}}return true}function getFbxVersion(text){var versionRegExp=/FBXVersion: (\d+)/;var match=text.match(versionRegExp);if(match){var version=parseInt(match[1]);return version}throw new Error("THREE.FBXLoader: Cannot find the version number for the file given.")}function convertFBXTimeToSeconds(time){return time/46186158000}var dataArray=[];function getData(polygonVertexIndex,polygonIndex,vertexIndex,infoObject){var index;switch(infoObject.mappingType){case"ByPolygonVertex":index=polygonVertexIndex;break;case"ByPolygon":index=polygonIndex;break;case"ByVertice":index=vertexIndex;break;case"AllSame":index=infoObject.indices[0];break;default:console.warn("THREE.FBXLoader: unknown attribute mapping type "+infoObject.mappingType)}if(infoObject.referenceType==="IndexToDirect"){index=infoObject.indices[index]
    }var from=index*infoObject.dataSize;var to=from+infoObject.dataSize;return slice(dataArray,infoObject.buffer,from,to)}var tempEuler=new THREE.Euler();var tempVec=new THREE.Vector3();function generateTransform(transformData){var lTranslationM=new THREE.Matrix4();var lPreRotationM=new THREE.Matrix4();var lRotationM=new THREE.Matrix4();var lPostRotationM=new THREE.Matrix4();var lScalingM=new THREE.Matrix4();var lScalingPivotM=new THREE.Matrix4();var lScalingOffsetM=new THREE.Matrix4();var lRotationOffsetM=new THREE.Matrix4();var lRotationPivotM=new THREE.Matrix4();var lParentGX=new THREE.Matrix4();var lGlobalT=new THREE.Matrix4();var inheritType=(transformData.inheritType)?transformData.inheritType:0;if(transformData.translation){lTranslationM.setPosition(tempVec.fromArray(transformData.translation))}if(transformData.preRotation){var array=transformData.preRotation.map(THREE.Math.degToRad);array.push(transformData.eulerOrder);lPreRotationM.makeRotationFromEuler(tempEuler.fromArray(array))}if(transformData.rotation){var array=transformData.rotation.map(THREE.Math.degToRad);array.push(transformData.eulerOrder);lRotationM.makeRotationFromEuler(tempEuler.fromArray(array))}if(transformData.postRotation){var array=transformData.postRotation.map(THREE.Math.degToRad);array.push(transformData.eulerOrder);lPostRotationM.makeRotationFromEuler(tempEuler.fromArray(array))}if(transformData.scale){lScalingM.scale(tempVec.fromArray(transformData.scale))}if(transformData.scalingOffset){lScalingOffsetM.setPosition(tempVec.fromArray(transformData.scalingOffset))}if(transformData.scalingPivot){lScalingPivotM.setPosition(tempVec.fromArray(transformData.scalingPivot))}if(transformData.rotationOffset){lRotationOffsetM.setPosition(tempVec.fromArray(transformData.rotationOffset))}if(transformData.rotationPivot){lRotationPivotM.setPosition(tempVec.fromArray(transformData.rotationPivot))}if(transformData.parentMatrixWorld){lParentGX=transformData.parentMatrixWorld}var lLRM=lPreRotationM.multiply(lRotationM).multiply(lPostRotationM);
        var lParentGRM=new THREE.Matrix4();lParentGX.extractRotation(lParentGRM);var lParentTM=new THREE.Matrix4();var lLSM;var lParentGSM;var lParentGRSM;lParentTM.copyPosition(lParentGX);lParentGRSM=lParentTM.getInverse(lParentTM).multiply(lParentGX);lParentGSM=lParentGRM.getInverse(lParentGRM).multiply(lParentGRSM);lLSM=lScalingM;var lGlobalRS;if(inheritType===0){lGlobalRS=lParentGRM.multiply(lLRM).multiply(lParentGSM).multiply(lLSM)}else{if(inheritType===1){lGlobalRS=lParentGRM.multiply(lParentGSM).multiply(lLRM).multiply(lLSM)}else{var lParentLSM=new THREE.Matrix4().copy(lScalingM);var lParentGSM_noLocal=lParentGSM.multiply(lParentLSM.getInverse(lParentLSM));lGlobalRS=lParentGRM.multiply(lLRM).multiply(lParentGSM_noLocal).multiply(lLSM)}}var lTransform=lTranslationM.multiply(lRotationOffsetM).multiply(lRotationPivotM).multiply(lPreRotationM).multiply(lRotationM).multiply(lPostRotationM).multiply(lRotationPivotM.getInverse(lRotationPivotM)).multiply(lScalingOffsetM).multiply(lScalingPivotM).multiply(lScalingM).multiply(lScalingPivotM.getInverse(lScalingPivotM));var lLocalTWithAllPivotAndOffsetInfo=new THREE.Matrix4().copyPosition(lTransform);var lGlobalTranslation=lParentGX.multiply(lLocalTWithAllPivotAndOffsetInfo);lGlobalT.copyPosition(lGlobalTranslation);lTransform=lGlobalT.multiply(lGlobalRS);return lTransform}function getEulerOrder(order){order=order||0;var enums=["ZYX","YZX","XZY","ZXY","YXZ","XYZ",];if(order===6){console.warn("THREE.FBXLoader: unsupported Euler Order: Spherical XYZ. Animations and rotations may be incorrect.");return enums[0]}return enums[order]}function parseNumberArray(value){var array=value.split(",").map(function(val){return parseFloat(val)});return array}function convertArrayBufferToString(buffer,from,to){if(from===undefined){from=0}if(to===undefined){to=buffer.byteLength}return THREE.LoaderUtils.decodeText(new Uint8Array(buffer,from,to))}function append(a,b){for(var i=0,j=a.length,l=b.length;i<l;i++,j++){a[j]=b[i]}}function slice(a,b,from,to){for(var i=from,j=0;
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             i<to;i++,j++){a[j]=b[i]}return a}function inject(a1,index,a2){return a1.slice(0,index).concat(a2).concat(a1.slice(index))}return FBXLoader})();
}