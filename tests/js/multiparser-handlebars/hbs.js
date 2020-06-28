import { hbs } from 'ember-cli-htmlbars';

class MyComponent extends Component {
  constructor() {
    super();
    this.mood = 'happy';
  }

  async rerender() {
    await render(hbs`<MyComponent class={{this.classes}}/>`);
  }

  template() {
    return hbs`
         Glimmer            Components         are     <span


      class="mood"      >
      </span

           >!
           {{hello-mustache}}
    `;
  }
}

const someHbs1 = hbs`<div       > hello {{world}} </div     >`;
const someHbs2 = /* Handlebars */ `<div      > hello {{world}} </div     >`;

hbs``

hbs`<MyElement prop={{@prop}} anotherProp={{@anotherProp}} yetAnotherProp={{@yetAnotherProp}} {{modifier}}></MyElement>`;

hbs`  <div />  `

hbs`
  <div />
`

hbs`<span>one</span><span>two</span><span>three</span>`;

hbs`
 <div style=
{{this.styles}}
></div>
`

hbs`<div style="   color : red;
            display    :inline ">
  </div>`

const nestedFun = /* Handlebars */ html`${outerExpr}
  <script>
    const tpl = hbs\`<div>    {{innerExpr  }}</div>\`;
  </script>`;

const nestedFun2 = /* Handlebars */ html`${outerExpr}
  <script>
    const tpl = hbs\`\\n    <div>{{    innerExpr}}</div>\\n\`;
  </script>`;

setFoo(
  hbs`<div>one</div>
  {{a-mustache}}
    <div>two</div>
    <div>three</div>`,
  secondArgument
);

setFoo(
  hbs`<div>
      <div>nested</div>
    </div>
  {{a-mustache}}
    <div>two</div>
    <div>three</div>`,
  secondArgument
);

hbs`<MyElement prop={{@prop}} anotherProp={{@anotherProp}}
yetAnotherProp={{@yetAnotherProp}}
       {{modifier}}
    />`;

hbs`\``
