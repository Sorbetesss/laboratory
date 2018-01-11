"use strict";

const React = require("react");

const CompLibrary = require("../../core/CompLibrary.js");
const MarkdownBlock = CompLibrary.MarkdownBlock;
const Container = CompLibrary.Container;
const GridBlock = CompLibrary.GridBlock;
const AnimatedLogo = require(process.cwd() + "/components/AnimatedLogo");

const siteConfig = require(process.cwd() + "/siteConfig.js");

class Button extends React.Component {
  render() {
    return (
      <div className="pluginWrapper buttonWrapper">
        <a className="button" href={this.props.href} target={this.props.target}>
          {this.props.children}
        </a>
      </div>
    );
  }
}

Button.defaultProps = {
  target: "_self"
};

Button.propTypes = {
  href: React.PropTypes.string,
  target: React.PropTypes.string,
  children: React.PropTypes.any
};

class HomeSplash extends React.Component {
  render() {
    return (
      <div className="homeContainer">
        <div className="homeSplashFade">
          <div className="wrapper homeWrapper">
            <div className="animatedLogoWrapper">
              <AnimatedLogo />
            </div>
            <div className="inner">
              <div className="section promoSection">
                <div className="promoRow">
                  <div className="pluginRowBlock">
                    <Button href="/playground/">Try It Out</Button>
                    <Button
                      href={"/docs/" + this.props.language + "/install.html"}
                    >
                      Get Started
                    </Button>
                    <Button
                      href={"/docs/" + this.props.language + "/options.html"}
                    >
                      Options
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

HomeSplash.propTypes = {
  language: React.PropTypes.string
};

const TldrSection = ({ language }) => (
  <div className="tldrSection productShowcaseSection lightBackground paddingTop paddingBottom">
    <Container>
      <div style={{ display: "flex", flexFlow: "row wrap" }}>
        <div style={{ flex: "1 1 auto" }}>
          <h2>What is Prettier?</h2>
          <ul>
            <li>An opinionated code formatter</li>
            <li>Supports many languages</li>
            <li>Integrates with the most editors</li>
            <li>Has few options</li>
          </ul>
          <Button href={"/docs/" + language + "/index.html"}>What Else?</Button>
        </div>
        <div style={{ flex: "1 1 auto" }}>
          <h2>Why?</h2>
          <ul>
            <li>You press save and code is formatted</li>
            <li>No need to discuss style in code review</li>
            <li>Saves you time and energy</li>
          </ul>
          <Button href={"/docs/" + language + "/why-prettier.html"}>
            Why Else?
          </Button>
        </div>
      </div>
    </Container>
  </div>
);

TldrSection.propTypes = {
  language: React.PropTypes.string
};

const LanguagesSection = () => (
  <div
    className="languagesSection productShowcaseSection paddingTop paddingBottom"
    style={{ textAlign: "center" }}
  >
    <Container>
      <h2 style={{ margin: 0 }}>Language Support</h2>
      <GridBlock
        align="center"
        contents={siteConfig.supportedLanguages.map(language => ({
          title: language.name,
          image: language.image,
          imageAlign: "top",
          content: language.variants.join("\n\n")
        }))}
        layout="fourColumn"
      />
    </Container>
  </div>
);

const Editor = ({ content = "", image, name }) => (
  <div style={{ display: "flex", width: "235px", padding: "20px" }}>
    <img src={image} style={{ width: "100px", height: "100px" }} />
    <div style={{ flexGrow: 1, paddingLeft: "8px" }}>
      <h3 style={{ marginBottom: "-16px" }}>{name}</h3>
      <MarkdownBlock>{content.replace(/\n/g, "  \n")}</MarkdownBlock>
    </div>
  </div>
);

Editor.propTypes = {
  content: React.PropTypes.string,
  image: React.PropTypes.string.isRequired,
  name: React.PropTypes.string.isRequired
};

const EditorSupportSection = () => (
  <div className="editorSupportSection productShowcaseSection lightBackground paddingTop paddingBottom">
    <Container>
      <h2>Editor Support</h2>
      <div
        style={{
          display: "flex",
          flexFlow: "row wrap",
          justifyContent: "space-around"
        }}
      >
        {siteConfig.editors.map(editor => (
          <Editor key={editor.name} {...editor} />
        ))}
      </div>
    </Container>

    <div style={{ float: "right" }}>
      <span>Got more? </span>
      <a
        href={`${siteConfig.githubUrl}/edit/master/website/data/editors.yml`}
        className="button"
      >
        Send a PR
      </a>
    </div>
  </div>
);

const bash = (...args) => `~~~bash\n${String.raw(...args)}\n~~~`;

const json = object => `~~~json\n${JSON.stringify(object, null, 2)}\n~~~`;

class GetStartedSection extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      npmClient: "yarn"
    };
  }

  render() {
    return (
      <div className="getStartedSection productShowcaseSection paddingTop paddingBottom">
        <Container>
          <h2>Get Started</h2>
          <div>
            <ol>
              <li>
                Add prettier to your project:
                <MarkdownBlock>
                  {bash`yarn add prettier --dev --exact`}
                </MarkdownBlock>
              </li>
              <li>
                Verify by running against a file:
                <MarkdownBlock>
                  {bash`yarn prettier --write src/index.js`}
                </MarkdownBlock>
              </li>
              <li>
                Run prettier when commiting files:
                <MarkdownBlock>
                  {bash`yarn add pretty-quick husky --dev`}
                </MarkdownBlock>
                Then edit <code>package.json</code>:
                <MarkdownBlock>
                  {json({
                    scripts: {
                      precommit: "pretty-quick --staged"
                    }
                  })}
                </MarkdownBlock>
              </li>
            </ol>
          </div>
        </Container>
      </div>
    );
  }
}

const UsersSection = ({ language }) => {
  const showcase = siteConfig.users
    .filter(user => {
      return user.pinned;
    })
    .map((user, i) => {
      return (
        <a key={i} href={user.infoLink}>
          <img
            src={user.image}
            title={user.caption}
            style={{ height: "100px", width: "200px" }}
          />
        </a>
      );
    });

  return (
    <div className="usersSection productShowcaseSection lightBackground paddingTop paddingBottom">
      <Container>
        <h2>Used By People You Rely On</h2>
        <div className="logos">{showcase}</div>
        <div className="more-users">
          <a
            className="button"
            href={siteConfig.baseUrl + language + "/users/"}
            target="_self"
          >
            See All Others
          </a>
          <a
            className="button"
            href={`${siteConfig.githubUrl}/edit/master/website/data/users.yml`}
          >
            Add Your Project
          </a>
        </div>
      </Container>
    </div>
  );
};

UsersSection.propTypes = {
  language: React.PropTypes.string
};

class Index extends React.Component {
  render() {
    const language = this.props.language || "en";

    return (
      <div>
        <script src="landing.js" />
        <HomeSplash language={language} />
        <div className="mainContainer">
          <TldrSection language={language} />
          <LanguagesSection />
          <EditorSupportSection />
          <GetStartedSection />
          <UsersSection language={language} />
        </div>
      </div>
    );
  }
}

Index.propTypes = {
  language: React.PropTypes.string
};

module.exports = Index;
