const handleSubmit = async (values: ConditionForm) => {
      setLoading(true);
      try {
        if (!photos.length) {
          throw new Error('Please upload at least one photo');
        }

        // First upload photos
        await uploadPhotos(photos);

        // Then generate listing
        await generateListing(values.condition, values.level);
        navigate('/processing');
      } catch (error) {
        console.error('Error generating listing:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to generate listing"
        });
      } finally {
        setLoading(false);
      }
    };