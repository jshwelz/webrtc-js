describe("Voxbone", function() {
  var voxbone;

  beforeEach(function() {
    voxbone = new Voxbone();
    spyOn(console, 'log');
  });

  it("should be defined", function() {
    expect(voxbone).toBeDefined();
  });

  it("should be able to instantiate a second object different than the previous one", function() {
    var voxbone2 = new Voxbone();
    expect(voxbone).not.toEqual(voxbone2);
  });

});
