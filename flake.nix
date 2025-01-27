{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.11";
    flake-utils.url = "github:numtide/flake-utils";
  };

  description = "WSCat";

  outputs = { self, nixpkgs, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
      in
      rec {
        packages = {
          wscat = pkgs.callPackage ./default.nix { inherit pkgs; };
        };

		    defaultPackage = packages.wscat;

        devShells = {
          default = pkgs.mkShell {
            buildInputs = with pkgs; [
              nodejs_22
            ];
          };
        };
    }
  );
}
