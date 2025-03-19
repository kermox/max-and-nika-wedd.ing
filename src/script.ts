// Tidier code with webpack and better Typescript in Github
// https://github.com/ste-vg/svg-squiggles

console.clear();

declare var Observable:any;
declare var TweenLite:any;
declare var Power2:any;

enum SquiggleState
{
    ready,
    animating,
    ended
}

interface Position
{
    x: number;
    y: number;
}

interface SquiggleSet
{
    path: SVGPathElement;
    settings: SquiggleSettings;
}

interface SquiggleSettings
{
    x: number;
    y: number;
    directionX: number;
    directionY: number;
    length?: number;
    sections: number;
    width?: number;
    chunkLength?: number;
    color?: string;
    progress?: number;
    opacity?: number;
}

class Squiggle
{
    private grid:number;
    private stage:HTMLElement;
    private sqwig:SVGPathElement;
    private sqwigs: SquiggleSet[] = [];
    private settings:SquiggleSettings;
    public state:SquiggleState = SquiggleState.ready;

    constructor(stage:HTMLElement, settings:SquiggleSettings, grid:number)
    {
        this.grid = grid;
        this.stage = stage;
   
        settings.width = 0;
        settings.opacity = 1;

        this.state = SquiggleState.animating;
        let path = this.createLine(settings);
        let sqwigCount:number = 3;
        for(let i = 0; i < sqwigCount; i++)
        {
            this.createSqwig(i, sqwigCount, path, JSON.parse(JSON.stringify(settings)) as SquiggleSettings, i == sqwigCount - 1)
        }
    }

    createSqwig(index:number, total:number, path:string, settings:SquiggleSettings, forceWhite:boolean)
    {
        let sqwig = document.createElementNS("http://www.w3.org/2000/svg", 'path')
            sqwig.setAttribute('d', path)
            sqwig.style.fill = 'none';
            sqwig.style.stroke = forceWhite ? '#303030' : this.getColor();
            sqwig.style.strokeLinecap = "round"
        
        settings.length =  sqwig.getTotalLength();
        settings.chunkLength = settings.length / 6; //(settings.sections * 2) + (Math.random() * 40);
        settings.progress = settings.chunkLength;

        sqwig.style.strokeDasharray= `${settings.chunkLength}, ${settings.length + settings.chunkLength}`
        sqwig.style.strokeDashoffset = `${settings.progress}`

        this.stage.appendChild(sqwig);

        this.sqwigs.unshift({path: sqwig, settings: settings});

        TweenLite.to(settings, settings.sections * 0.1, {
            progress: - settings.length,
            width: settings.sections * 0.9,
            ease: Power1.easeOut,
            delay: index * (settings.sections * 0.01),
            onComplete: () => 
            {
                if(index = total - 1) this.state = SquiggleState.ended;
                sqwig.remove();
            }
        })
    }

    public update()
    {
        this.sqwigs.map((set: SquiggleSet) => 
        {
            set.path.style.strokeDashoffset = `${set.settings.progress}`;
            set.path.style.strokeWidth = `${set.settings.width}px`;
            set.path.style.opacity = `${set.settings.opacity}`;
        })
        
    }

    private createLine(settings:SquiggleSettings):string
    {
        let x = settings.x;
        let y = settings.y;
        let dx = settings.directionX;
        let dy = settings.directionY;
        let path:string[] = [
            'M',
            '' + x,
            '' + y,
            "Q"
        ]

        let steps = settings.sections;
        let step = 0;
        let getNewDirection = (direction: string, goAnywhere:boolean) => 
        {
            if(!goAnywhere && settings['direction' + direction.toUpperCase()] != 0) return settings['direction' + direction.toUpperCase()];
            return Math.random() < 0.5 ? -1 : 1;
        }

        while(step < steps * 2)
        {
            step++;
            x += (dx * (step/ 30)) * this.grid;
            y += (dy * (step/ 30)) * this.grid;
            if(step != 1) path.push(',');
            path.push('' + x);
            path.push('' + y);
            
            if(step % 2 != 0)
            {
                dx = dx == 0 ? getNewDirection('x', step > 8) : 0;
                dy = dy == 0 ? getNewDirection('y', step > 8) : 0;
            }
        }
        
        return path.join(' ');
    }

    private getColor():string
    {
        const colors = ['#FFA500', '#FFFF00', '#8A2BE2', '#FFC0CB']; // Orange, Yellow, Violet, Pink
        return colors[Math.floor(Math.random() * colors.length)];
    }
}

class App
{
	private container:HTMLElement;
	private svg:HTMLElement;
	private squiggles:Squiggle[] = [];

	private width: number = 600;
	private height: number = 600;

	private lastMousePosition:Position;
	private direction:Position;

	private grid:number = 40;

	constructor(container:HTMLElement)
	{
		this.container = container;
		this.svg = document.getElementById('stage');
		this.onResize();

		this.tick();

		let input = new Input(this.container);
		
		input.moves.subscribe((position:Position) => 
		{
			for(let i = 0; i < 3; i++) this.createSqwigFromMouse(position);
		})
		
		input.starts.subscribe((position:Position) => this.lastMousePosition = position)
		input.ends.subscribe((position:Position) => this.burst(true))
		
		if(location.pathname.match(/fullcpgrid/i)) setInterval(() => this.burst(false), 1000);

		Rx.Observable.fromEvent(window, "resize").subscribe(() => this.onResize())
	}
	
	burst(fromMouse:boolean = false)
	{
		for(let i = 0; i < 5; i++) this.createRandomSqwig(fromMouse);
	}

	createSqwigFromMouse(position:Position)
	{
		let sections:number = 4;
		if(this.lastMousePosition)
		{
			let newDirection:Position = {x: 0, y: 0};
			let xAmount = Math.abs(this.lastMousePosition.x - position.x);
			let yAmount = Math.abs(this.lastMousePosition.y - position.y);

			if(xAmount > yAmount)
			{
				newDirection.x = this.lastMousePosition.x - position.x < 0 ? 1 : -1;
				sections += Math.round(xAmount/4)
			}
			else
			{
				newDirection.y = this.lastMousePosition.y - position.y < 0 ? 1 : -1;
				sections += Math.round(yAmount/4)
			}
			this.direction = newDirection;
		}

		if(this.direction)
		{
			let settings:SquiggleSettings = {
				x: this.lastMousePosition.x,
				y: this.lastMousePosition.y,
				directionX: this.direction.x,
				directionY: this.direction.y,
				sections: sections > 20 ? 20 : sections
			}
			let newSqwig = new Squiggle(this.svg, settings, 10 + Math.random() * (sections * 1.5));
			this.squiggles.push(newSqwig);
		}
		
		this.lastMousePosition = position;
	}

	createRandomSqwig(fromMouse:boolean = false)
	{
		let dx = Math.random();
		if(dx > 0.5) dx = dx > 0.75 ? 1 : -1;
		else dx = 0;
		let dy = 0;
		if(dx == 0) dx = Math.random() > 0.5 ? 1 : -1;

		let settings:SquiggleSettings = {
			x: fromMouse ? this.lastMousePosition.x : this.width / 2, // Math.round(Math.random() * (this.width / this.grid))  * this.grid,
			y: fromMouse ? this.lastMousePosition.y : this.height / 2, //Math.round(Math.random() * (this.height / this.grid)) * this.grid,
			directionX: dx,
			directionY: dy,
			sections: 5 + Math.round(Math.random() * 15)
		}
		let newSqwig = new Squiggle(this.svg, settings, this.grid/2 + Math.random() * this.grid/2);
		this.squiggles.push(newSqwig);
	}

	onResize()
	{
		this.width = this.container.offsetWidth;
		this.height = this.container.offsetHeight;

		this.svg.setAttribute('width', String(this.width));
		this.svg.setAttribute('height', String(this.height));
	}

	tick()
	{
		let step = this.squiggles.length - 1;

		while(step >= 0)
		{
			if(this.squiggles[step].state != SquiggleState.ended)
			{
				this.squiggles[step].update();
				
			}
			else
			{
				this.squiggles[step] = null;
				this.squiggles.splice(step, 1);
			}

			--step;	
		}

		requestAnimationFrame(() => this.tick());
	}
}

class Input
{
    private mouseDowns:Observable<Position>;
    private mouseMoves:Observable<Position>;
    private mouseUps:Observable<Position>;

    private touchStarts:Observable<Position>;
    private touchMoves:Observable<Position>;
    private touchEnds:Observable<Position>;

    public starts:Observable<Position>;
    public moves:Observable<Position>;
    public ends:Observable<Position>;

    constructor(element:HTMLElement)
    {
        this.mouseDowns = Rx.Observable.fromEvent(element, "mousedown").map(this.mouseEventToCoordinate);
        this.mouseMoves = Rx.Observable.fromEvent(window, "mousemove").map(this.mouseEventToCoordinate);
        this.mouseUps = Rx.Observable.fromEvent(window, "mouseup").map(this.mouseEventToCoordinate);

        this.touchStarts = Rx.Observable.fromEvent(element, "touchstart").map(this.touchEventToCoordinate);
        this.touchMoves = Rx.Observable.fromEvent(element, "touchmove").map(this.touchEventToCoordinate);
        this.touchEnds = Rx.Observable.fromEvent(window, "touchend").map(this.touchEventToCoordinate);

        this.starts = this.mouseDowns.merge(this.touchStarts);
        this.moves = this.mouseMoves.merge(this.touchMoves);
        this.ends = this.mouseUps.merge(this.touchEnds);
    }

    private mouseEventToCoordinate = (mouseEvent:MouseEvent) => 
    {
        mouseEvent.preventDefault();
        return {
            x: mouseEvent.clientX, 
            y: mouseEvent.clientY
        };
    };

    private touchEventToCoordinate = (touchEvent:TouchEvent) => 
    {
        touchEvent.preventDefault();
        return {
            x: touchEvent.changedTouches[0].clientX, 
            y: touchEvent.changedTouches[0].clientY
        };
    };
}

let container = document.getElementById('app');
let app = new App(container);