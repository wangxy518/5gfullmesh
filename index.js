/*
 * @description: 
 * @Author: Gouxinyu
 * @Date: 2020-11-14 14:26:49
 */
class Pointer {
    constructor() {
        this.boxId = ''; // 容器id
        this.pointList = []; // 点列表
        this.buttons = []; // 按钮列表
    };

    init(options) {
        this.boxId = options.boxId;
        this.pointList = options.pointList;
        this.buttons = options.buttons;

        const pointBox = `<div id="point-box-bg"></div>`

        $(`#${this.boxId}`).append(pointBox);

        let pointDom = '';
        for (let i = 0; i < this.pointList.length; i++) {
            const item = this.pointList[i];

            pointDom += `<div class="my-point" data-name="${item.name}" style="left: ${item.left + 400}px; top: ${item.top}px">
                <div class="point-name">
                    <div class="point-left"></div>
                    <div class="point-center" style="width: ${item.name.length * 24}px">
                        <span class="point-text">${item.name}</span>
                    </div>
                    <div class="point-right"></div>
                </div>
                <img src="attach/educateImgs/point.png" alt="">
                <div class="circle-1"></div>
                <div class="circle-2"></div>
                <div class="circle-3"></div>
            </div>`
        }

        $('#point-box-bg').append(pointDom).css({
            transition: `transform ${options.speed}s ${options.animateType}`
        });

        this.buttonsClick();
    };

    buttonsClick() {
        for (let i = 0; i < this.buttons.length; i++) {
            const item = this.buttons[i];
            $(`#${item.id}`).on('click', function () {
                $('#point-box-bg').css({
                    transform: `translate3d(${item.dis}px,0,0)`
                })
            })

        }
    }

    // 点击事件回调
    pointClick(callback) {
        $('.my-point').on('click', function (e) {
            if (callback) {
                callback(e, $(this))
            }
        })
    }
}