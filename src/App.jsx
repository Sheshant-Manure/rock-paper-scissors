import React from "react";
import "./App.css";
import paperImg from "./assets/paper.png";
import scissors1Img from "./assets/scissors.png";
import rockImg from "./assets/rock.png";
import lizardImg from "./assets/lizard.png";
import spockImg from "./assets/spock.png";

const App = () => {
  const images = [
    { src: paperImg, alt: "paper" },
    { src: scissors1Img, alt: "scissors 1" },
    { src: rockImg, alt: "rock" },
    { src: lizardImg, alt: "lizard" },
    { src: spockImg, alt: "spock" },
  ];

  return (
    <div className="image-container">
      {images.map((image, index) => (
        <img
          key={index}
          src={image.src}
          alt={image.alt}
          style={{
            width: "100px",
            height: "100px",
          }}
          className="asset-image"
        />
      ))}
    </div>
  );
};

export default App;
