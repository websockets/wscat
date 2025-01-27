{
  lib,
  stdenv,
  buildNpmPackage,
  fetchFromGitHub,
  ...
}:

buildNpmPackage rec {
  pname = "wscat";
  version = "6.0.1";
  src = ./.;

  npmDepsHash = "sha256-na8Vv/inWmLrXI+7uAMofJgBzg2jo2gGYGva2B/7iWc=";
  dontNpmBuild = true;
  installPhase = ''
    runHook preInstall
    cp -r . "$out"
    runHook postInstall
  '';

  meta = {
    description = "WebSocket cat";
    homepage = "https://github.com/websockets/wscat.git";
    license = lib.licenses.mit;
    maintainers = with lib.maintainers; [ ];
    mainProgram = "wscat";
    platforms = lib.platforms.all;
  };
}
