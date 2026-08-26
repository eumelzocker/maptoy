{
  description = "maptoy development environment";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";

  outputs = {nixpkgs, ...}: let
    supportedSystems = [
      "x86_64-linux"
      "aarch64-linux"
    ];
    forAllSystems = nixpkgs.lib.genAttrs supportedSystems;
  in {
    devShells = forAllSystems (
      system: let
        pkgs = import nixpkgs {inherit system;};
      in {
        default = pkgs.mkShell {
          packages = with pkgs; [
            nodejs_24
            pnpm

            # Native image, metadata, projection, and export tooling.
            pkg-config
            vips
            proj
            gdal
            exiftool
          ];

          PROJ_DATA = "${pkgs.proj}/share/proj";
          GDAL_DATA = "${pkgs.gdal}/share/gdal";

          shellHook = ''
            export MAPTOY_REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
            echo "maptoy development shell"
            echo "Node $(node --version), pnpm $(pnpm --version)"
          '';
        };
      }
    );

    formatter = forAllSystems (system: nixpkgs.legacyPackages.${system}.alejandra);
  };
}
