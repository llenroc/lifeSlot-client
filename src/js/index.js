require('./utils');
const noUiSlider = require('./nouislider.min');
const BigNumber = require('./bignumber.min');
const abi = require('./conf.js');
import Spinner from './spinner';
import '../css/style.scss';
import '../css/nouislider.min.css';

class App {

    constructor() {
        this.spinnerList = undefined;
        this.address = '0x995f617066a6968749eb980c2613314f4d45d4ab';
        this.contract = window.web3.eth.contract(abi);
        this.ETHBlockByte = this.contract.at(this.address);
        this.step = 1000000000000000; // 0.001 ETH

        this.checkMetaMask();
        this.init(this.address, this.ETHBlockByte);
        this.initSpinner();
    }

    checkMetaMask() {
        if (typeof window.web3 !== 'undefined') {
            window.web3 = new Web3(window.web3.currentProvider);
        } else {
            window.web3 = new Web3(new Web3.providers.HttpProvider("http://127.0.0.1:8545"));
        }

        if (!window.web3.eth.accounts[0]) {
            const interval = setInterval(function () {
                if (web3.eth.accounts[0]) {
                    clearInterval(interval);
                    document.getElementById('error').innerText = '';
                    let interval = setInterval(() => {
                        this.updateBalance();
                    }, 2000);
                }
                else {
                    document.getElementById('error').innerText = 'Unlock metamask account';
                }
            }, 5000);
        } else {
            this.updateBalance();
        }
    }

    buildSpinners() {
        this.spinnerList = document.getElementsByClassName('carousel-item');

        for (let spinner = 0; spinner < this.spinnerList.length; spinner++) {
            this.spinnerList[spinner].carousel = new Spinner(this.spinnerList[spinner]);

            this.spinnerList[spinner].carousel.panelCount = 11;
            this.spinnerList[spinner].carousel.modify();
        }
    };

    parseResult(result) {
        let resultArray = ('' + result).split('');
        if (resultArray.length === 3) {
            return resultArray;
        }
        if (resultArray.length === 2) {
            resultArray.unshift(0);
            return resultArray;
        }
        if (resultArray.length === 1) {
            resultArray.unshift(0);
            resultArray.unshift(0);
            return resultArray;
        }
    };

    resetSpinner() {
        this.setStandByOff();
        for (let spinner in this.spinnerList) {
            if (spinner === 'length') {
                return;
            }
            this.spinnerList[spinner].carousel.rotation = 0;
            this.spinnerList[spinner].carousel.transform();
        }
    };

    getRandomArbitrary(min, max) {
        return Math.random() * (max - min) + min;
    };

    spin(key, spinner) {
        this.setStandByOff();
        this.spinnerList[key].carousel.rotation = 0;
        this.spinnerList[key].carousel.transform();
        if (spinner === 0) return;
        let spin = parseInt(spinner) + 12;
        let time = this.getRandomArbitrary(100, 800);

        setTimeout(() => {
            this.spinnerList[key].carousel.rotation += this.spinnerList[key].carousel.theta * spin * -1;
            this.spinnerList[key].carousel.transform();
        }, time);

        setTimeout(() => {
            const spinners = document.getElementsByClassName('spinners');
            spinners[0].removeClassName('spinning-play');
        }, 2000);

    };

    setStandByPlayOn() {
        var spinners = document.getElementsByClassName('spinners');
        spinners[0].addClassName('spinning-play');
        spinners[0].removeClassName('spinning');
    };


    setStandByOn() {
        let spinners = document.getElementsByClassName('spinners');
        spinners[0].addClassName('spinning');
    };

    setStandByOff() {
        var spinners = document.getElementsByClassName('spinners');
        spinners[0].removeClassName('spinning');
    };

    spinFromPlay(result) {
        let parsedResult = this.parseResult(result);

        for (let spinner in this.spinnerList) {
            if (spinner === 'length') {
                return;
            }
            this.spin(spinner, parsedResult[spinner]);
        }
    };

    initSpinner() {

        this.buildSpinners();

        setTimeout(() => {
            this.setStandByOn();
        }, 1600);

        setTimeout(() => {
            document.body.addClassName('ready');
        }, 0);

    };

    updateBalance() {
        web3.eth.getBalance(web3.eth.accounts[0], function (e, r) {
            document.getElementById('account').innerText = parseFloat(web3.fromWei(r, 'ether')).toFixed(5) + ' ETH';
        });
    };


    data(address, contract) {
        return {
            contract: contract,
            address: address,
            owner: null,
            create_block: 0,
            balance: 0,
            max_fee: 0,
            last_result: null
        };
    };

    init(address, contract) {
        const proxy = new Proxy(this.data(address, contract), {
            set: function (obj, prop, value) {
                obj[prop] = value;
                switch (prop) {
                    case 'balance':
                    case 'max_fee':
                        document.getElementById(prop).innerText = parseFloat(web3.fromWei(value, 'ether')).toFixed(5) + ' ETH';
                        break;

                    case 'last_result':
                        var _value = parseInt(value);
                        document.getElementById(prop).innerText = _value;
                        break;

                    case 'address':
                    case 'owner':
                        var a = document.createElement('a');
                        a.setAttribute('href', 'https://ropsten.etherscan.io/address/' + value);
                        a.setAttribute('target', '_blank');
                        a.innerText = value;
                        document.getElementById(prop).removeChild(document.getElementById(prop).firstChild);
                        document.getElementById(prop).append(a);
                        break;
                }
                return true;
            }
        });

        let all_events = proxy.contract.allEvents({fromBlock: 'latest'}, (e, r) => {

            switch (r.event) {
                case 'Play':
                    this.render_play(r);
                    proxy.last_result = parseInt(r.args._result);

                    if (r.args._sender == web3.eth.accounts[0]) {
                        this.spinFromPlay(proxy.last_result);
                    }

                    break;

                case 'Balance':
                    proxy.balance = r.args._balance;
                    proxy.contract.max_fee((e, r) => {
                        proxy.max_fee = r;

                        let max_fee = parseInt(parseInt(r / this.step) * this.step);
                        document.getElementById('fee-slider').noUiSlider.updateOptions({
                            range: {
                                min: this.step,
                                max: max_fee
                            }
                        });
                    });
                    break;

                case 'Destroy':
                    all_events.stopWatching();
                    break;
            }
        });
        this.render(proxy);
        this.collect_data(proxy);
    };

    collect_old_events(data) {
        web3.eth.getBlockNumber((e, r) => {
            let to_block = r;
            data.contract.Play({_sender: [web3.eth.accounts[0]]}, {
                fromBlock: data.create_block,
                toBlock: to_block
            }, (e, r) => {
                if (e) {
                    console.log(e);
                    return;
                }
                this.render_play(r);
            });
        });
    };

    collect_data(data) {
        var contract = data.contract;
        web3.eth.getBalance(data.address, function (e, r) {
            data.balance = r;
        });
        contract.owner(function (e, r) {
            data.owner = r;
        });
        contract.max_fee((e, r) => {
            data.max_fee = r;
            this.create_sliders(r);
        });
        contract.create_block((e, r) => {
            data.create_block = r;
            setTimeout(() => {
                this.collect_old_events(data);
            }, 2000);
        });
        contract.last_result(function (e, r) {
            data.last_result = r;
        });
        data.address = data.address;
    };

    time_now() {
        var d = new Date();
        var now = Math.floor(d.getTime() / 1000);
        return now;
    };

    time_ago(timestamp) {
        var seconds = this.time_now() - timestamp;
        if (seconds > 2 * 86400) {
            return Math.floor(seconds / 86400) + ' days ago';
        }
        if (seconds > 86400) {
            return 'yesterday';
        }
        if (seconds > 3600) {
            return Math.floor(seconds / 3600) + ' hours ago';
        }
        if (seconds > 60) {
            return Math.floor(seconds / 60) + ' min ago';
        }
        return 'a few sec ago';
    }

    update_time_ago() {
        var times = document.getElementsByTagName('time');
        for (var i = 0; i < times.length; i++) {
            times[i].innerText = this.time_ago(times[i].dataset.timestamp);
        }
    };

    wait_play(tx) {
        let id = tx;
        const el = document.getElementById(id);
        if (!el) {
            var article = document.getElementById('play');
            var div = document.createElement('div');
            div.id = id;
            div.className = 'line pending';

            var time = document.createElement('time');
            time.dataset.timestamp = this.time_now();
            var text = document.createTextNode('NOW');
            time.appendChild(text);
            div.appendChild(time);

            var text = document.createTextNode('Tx pending, wating for sonerex');
            div.appendChild(text);
            article.prepend(div);
        }
    };

    render_play(play_event) {
        let id = play_event.transactionHash;
        var el = document.getElementById(id);
        if (el) {
            el.parentNode.removeChild(el);
        }
        var article = document.getElementById('play');
        var div = document.createElement('div');
        div.id = id;
        div.className = 'line';

        var time = document.createElement('time');
        time.dataset.timestamp = play_event.args._time;
        var text = document.createTextNode(this.time_ago(play_event.args._time));
        time.appendChild(text);
        div.appendChild(time);

        if (play_event.args._winner) {
            div.className = 'line winner';
        }
        var text = document.createTextNode('start: ' + parseInt(play_event.args._start) + ' end: ' + parseInt(play_event.args._end) + ' result: ' + parseInt(play_event.args._result));
        div.appendChild(text);
        article.prepend(div);
    };

    render(data) {

        let section = document.getElementById('section');
        let article = document.createElement('article');
        article.id = data.address;
        for (var key in data) {
            if (['contract', 'create_block'].indexOf(key) != -1) {
                continue;
            }
            var span = document.createElement('span');
            span.id = key;
            var text = document.createTextNode(data[key]);
            span.appendChild(text);
            var div = document.createElement('div');
            div.className = 'line';
            var text = document.createTextNode(key.replace('_', ' ') + ': ');
            div.appendChild(text);
            div.appendChild(span);
            article.appendChild(div);
        }
        var div = document.createElement('div');
        div.className = 'line';
        div.id = 'play-error';
        div.style = 'color: #f00;';
        var text = document.createTextNode('');
        div.appendChild(text);
        article.appendChild(div);

        var div = document.createElement('div');
        div.className = 'line';

        var h5 = document.createElement('h5');
        var text = document.createTextNode('Risk range from START to END, guess the RESULT between 1 and 255');
        h5.appendChild(text);
        div.appendChild(h5);

        var guess_slider = document.createElement('div');
        guess_slider.id = 'guess-slider';
        div.appendChild(guess_slider);

        var h5 = document.createElement('h5');
        var text = document.createTextNode('Participation fee to send in ETH (this controls the prize)');
        h5.appendChild(text);
        div.appendChild(h5);

        var fee_slider = document.createElement('div');
        fee_slider.id = 'fee-slider';
        div.appendChild(fee_slider);

        var input = document.createElement('input');
        input.id = 'submit';
        input.type = 'button';
        input.value = 'PLAY'
        input.addEventListener('click', () => {
            this.play(data);
        });
        div.appendChild(input);

        article.appendChild(div);

        var h3 = document.createElement('h3');
        var text = document.createTextNode('Play history');
        h3.appendChild(text);
        article.appendChild(h3);

        var div = document.createElement('div');
        div.className = 'line';
        div.id = 'play';
        article.appendChild(div);
        section.appendChild(article);

        setInterval(() => {
            this.update_time_ago();
        }, 60000);
    };

    create_sliders(max_fee) {
        let guess_slider = document.getElementById('guess-slider');
        noUiSlider.create(guess_slider, {
            start: [30, 225],
            step: 1,
            behaviour: 'drag',
            connect: [true, true, true],
            tooltips: true,
            range: {
                'min': 1,
                'max': 255
            },
            pips: {
                mode: 'values',
                values: [1, 255],
                density: 1
            },
            format: {
                to: function (value) {
                    return parseInt(value);
                },
                from: function (value) {
                    return parseInt(value);
                }
            }
        });

        let connect = guess_slider.querySelectorAll('.noUi-connect');
        connect[0].classList.add('red');
        connect[1].classList.add('blue');
        connect[2].classList.add('red');
        guess_slider.noUiSlider.on('set', () => {
            this.calculate_prize();
        });

        max_fee = parseInt(parseInt(max_fee / this.step) * this.step);
        let fee_slider = document.getElementById('fee-slider');
        noUiSlider.create(fee_slider, {
            start: 0.1,
            step: this.step,
            connect: [true, false],
            tooltips: true,
            range: {
                'min': this.step,
                'max': max_fee
            },
            format: {
                to: function (value) {
                    return parseFloat(web3.fromWei(value, 'ether')).toFixed(3) + ' ETH';
                },
                from: function (value) {
                    return web3.toWei(value.replace(' ETH', ''), 'ether');
                }
            }
        });

        connect = fee_slider.querySelectorAll('.noUi-connect');
        connect[0].classList.add('green');
        fee_slider.noUiSlider.on('set', () => {
            this.calculate_prize();
        });
        this.calculate_prize();
    };


    calculate_prize() {
        let guess_slider = document.getElementById('guess-slider').noUiSlider.get();
        let start = guess_slider[0];
        let end = guess_slider[1];
        let fee = web3.toWei(document.getElementById('fee-slider').noUiSlider.get().replace(' ETH', ''), 'ether');
        fee = new BigNumber(fee);

        let range = end - start + 1;
        let percentage = 100 - parseInt(range * 100 / 255);
        let prize = fee.times(percentage).div(100);
        let credit = fee.plus(prize);

        fee = parseFloat(web3.fromWei(fee, 'ether')).toFixed(3) + ' ETH';
        credit = parseFloat(web3.fromWei(credit, 'ether')).toFixed(3) + ' ETH';

        document.getElementById('submit').value = 'PLAY ' + fee + ' and WIN ' + credit;
    };

    play(data) {
        if (!web3.eth.accounts[0]) {
            document.getElementById('play-error').innerText = 'Unlock metamask account';
            return;
        }
        document.getElementById('play-error').innerText = '';
        var guess_slider = document.getElementById('guess-slider').noUiSlider.get()
        var start = ('0' + guess_slider[0].toString(16)).slice(-2);
        var end = ('0' + guess_slider[1].toString(16)).slice(-2);
        var fee = web3.toWei(document.getElementById('fee-slider').noUiSlider.get().replace(' ETH', ''), 'ether');
        if (start.length == 2 && start.match(/[0-9a-f]{2}/) &&
            end.length == 2 && end.match(/[0-9a-f]{2}/) &&
            fee.length > 0 && fee.match(/[0-9]+/)) {
            start = "0x" + start;
            end = "0x" + end;
            fee = new BigNumber(fee);
            data.contract.play(start, end, {from: web3.eth.accounts[0], value: fee}, (e, r) => {
                if (e) {
                    document.getElementById('play-error').innerText = 'Transaction was NOT completed, try again.';
                    console.log(e.message);
                }
                if (r) {
                    this.wait_play(r);
                    console.log('play tx ' + r);
                    this.setStandByPlayOn();

                }
            });
        }
        else {
            document.getElementById('play-error').innerText = 'enter start and end bytes';
        }
    };
}


window.addEventListener('DOMContentLoaded', function () {
    const app = new App();
}, false);
