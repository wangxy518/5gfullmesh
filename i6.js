function() {
    return {
        // 组件初始化
        init: function(options) {
            this._super.apply(this, arguments);
        },
        // 容器内所有组件加载完成
        allChildrenLoaded: function() {
              const imagesPath = 'attach/Three';
    const threeNode = new ThreeNode();
    threeNode.init('cnta_a1604386612095209', {
        controls: {
            enableZoom: false,
            enablePan: false,
            enableRotate: false
        },
        baseMap: {
            url: imagesPath +'images/bg.png',
            width: 1920,
            height: 1080
        }
    });
    threeNode.render();
    // -设置扫描门
    threeNode.setGate([{
        points: [
            {x: -772, y: 1, z: -136.0},
            {x: -772, y: 1, z: -199.0},
            {x: -468, y: 1, z: -372.0},
            {x: -468, y: 1, z: -309.0}
        ]
    }, {
        points: [
            {x: 441, y: 1, z: 354},
            {x: 441, y: 1, z: 291},
            {x: 747, y: 1, z: 116},
            {x: 747, y: 1, z: 179}
        ]
    }], {url: imagesPath + 'images/gate.png', speed: 0.2, repeat: 50});
    // -设置传送带
    threeNode.setGate([{
        points: [
            {x: -406.7, y: 1, z: -15},
            {x: 61, y: 1, z: -286},
            {x: 84, y: 1, z: -273},
            {x: -383, y: 1, z: -1}
        ]
    }, {
        points: [
            {x: -50.69, y: 1, z: 314.4},
            {x: 262.26, y: 1, z: 133.0},
            {x: 288.790, y: 1, z: 147.34},
            {x: -25.6, y: 1, z: 329.1}
        ]
    }, {
        points: [
            {x: 253.0, y: 1, z: -159.6},
            {x: 362.5, y: 1, z: -96.1},
            {x: 341.5, y: 1, z: -84.7},
            {x: 231.9, y: 1, z: -148.2}
        ]
    }, {
        points: [
            {x: 407.9, y: 1, z: -95.9},
            {x: 517.3, y: 1, z: -159.4},
            {x: 538.5, y: 1, z: -148},
            {x: 428.6, y: 1, z: -83.8}
        ]
    }], {url: imagesPath +'images/conveyor.png', speed: 1, repeat: 20});
    threeNode.setGate([{
        points: [
            {x: -417.0, y: 1, z: 264.7},
            {x: -417.0, y: 1, z: 280.7},
            {x: -426.9, y: 1, z: 275.3},
            {x: -426.9, y: 1, z: 259.6}
        ]
    }, {
        points: [
            {x: -620.4947577525265, y: -3.340135461027912e-14, z: 150.42632817652284},
            {x: -619.954025928004, y: -2.315269717851379e-14, z: 168.27047838577664},
            {x: -630.7686624184554, y: -2.2312231088087816e-14, z: 164.48535561411668},
            {x: -629.1464669448876, y: -1.8229967220304593e-14, z: 146.10047358034012}
        ]
    }], {url: imagesPath +'images/table.png', speed: .5, repeat: 20});
    threeNode.setGate([{
        points: [
            {x: -462.4167186047201, y: 1, z: 263.5},
            {x: -439.2197849049087, y: 1, z: 276.7},
            {x: -439.8, y: 1, z: 283.3},
            {x: -463.3, y: 1, z: 269.9}
        ]
    }, {
        points: [
            {x: -663.9982231128065, y: -1.9438655334628806e-14, z: 151.5439209216178},
            {x: -646.4741368308347, y: -3.5928599784421326e-14, z: 161.80802860106357},
            {x: -647.4755131898045, y: -3.6984763319963275e-14, z: 166.5645663061726},
            {x: -665.2499435615188, y: -2.0494818870170755e-14, z: 156.30045862672682}
        ]
    }], {url: imagesPath +'images/content.png', speed: .2, repeat: 500});

    threeNode.setPoints([
        {x: -397, y: 1, z: -10.0},
        {x: -147, y: 1, z: -156},
        {x: 74, y: 1, z: -283}
    ], {url: imagesPath +'images/upBox.png',segment:10,perTimes:1});
    threeNode.setPoints([
        {x: 242.0, y: 1, z: -156},
        {x: 381, y: 1, z: -92},
        {x: 531, y: 1, z: -159}
    ], {url: imagesPath +'images/centerBox.png',perTimes:2});
    threeNode.setPoints([
        {x: -43, y: 1, z: 321},
        {x: 116, y: 1, z: 232},
        {x: 281, y: 1, z: 137}
    ], {url: imagesPath +'images/downBox.png',segment:6,perTimes:1});

    threeNode.setStaticPoints([
        {x: 120.2, y: 1, z: 261.8},
        {x: 310.7, y: 1, z: 140.5},
        {x: -244.8, y: 1, z: -63.2},
        {x: 60.2, y: 1, z: -254.3}
    ], {
        url: imagesPath +'images/machine.png', size: 135
    });

    threeNode.setStaticPoints([
        {x: 23, y: 1, z: 311},
        {x: 217, y: 1, z: 202}
    ], {
        url: imagesPath +'images/crane.png', size: 200
    });

    threeNode.setStaticPoints([
        {x: 384, y: 1, z: -63}
    ], {
        url: imagesPath +'images/centerMachine.png', size: 150
    });

    threeNode.setStaticPoints([
        {x: 232, y: 2, z: -132}
    ], {
        url: imagesPath +'images/leftMachine.png', size: 150
    });

    threeNode.setJumpPoints([
        {x: -661.9410244554233, y: 1, z: 134.14052013019702},
        {x: -656.764487735844, y: 1, z: 136.72878848998798},
        {x: -651.2644174712909, y: 1, z: 139.64059039475282},
        {x: -644.7937465718168, y: 1, z: 142.55239229951763},
        {x: -644.4702130268431, y:1, z: 148.05246256407344},
        {x: -652.235018106212, y: 1, z: 145.78772774925636},
        {x: -656.4409541908703, y:1, z: 143.84652647941314},
    {x: -663.2351586353182, y: 1, z: 140.9347245746483},
        {x: -662.5880915453707, y: 1, z: 147.72892901909955},
        {x: -657.4115548257914, y:1, z: 149.34659674396892},
        {x: -649.9702832913961, y:1, z: 152.9054657386815},
        {x: -644.7937465718168, y:1, z: 155.8172676434463},
        {x: -458.43842466696066, y:1, z: 246.40666023613005},
        {x: -451.9677537674865, y: 1, z: 249.9655292308426},
        {x: -444.52648223309114, y: 1, z: 253.5243982255552},
        {x: -437.0852106986959, y: 1, z: 256.7597336752939},
        {x: -438.7028784235644, y:1, z: 262.25980393984975},
        {x: -447.11475059288085, y:1, z: 259.67153558005873},
        {x: -453.2618879473813, y: 1, z: 256.11266658534623},
        {x: -459.7325588468555, y: 1, z: 251.90673050068582},
        {x: -461.350226571724, y: 1, z: 259.024468490111},
        {x: -454.23248858230244, y: 1, z: 260.9656697599542},
        {x: -446.79121704790714, y: 1, z: 263.5539381197452},
        {x: -439.99701260345927, y:1, z: 268.0834077493794}
    ], {
        url: imagesPath +'images/content.png', size: 5,perTime:1
    });
        }
    };
}